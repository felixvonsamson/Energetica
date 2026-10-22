"""Unit tests for the loan in a Workshop session (#1225): taken and cancelled in an open Investment phase, paid back
as the next two Rounds start or when the session ends, and counted in the final score.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from energetica.identity.accounts import Account
from energetica.identity.instance_config import InstanceConfig
from energetica.workshop.balance_sheet import balance_sheet
from energetica.workshop.facilities import FacilityId
from energetica.workshop.score import score
from energetica.workshop.fleet import OwnedFacility
from energetica.workshop.loan import LOAN_AMOUNT, LOAN_COST, LOAN_PAYMENT, Loan
from energetica.workshop.player import WORKSHOP_CASH_FLOOR, WORKSHOP_STARTING_BUDGET, WorkshopPlayer
from energetica.workshop.session import (
    Finished,
    Investment,
    InvestmentClosedError,
    LoanFinalError,
    LoanLastRoundError,
    LoanNeededError,
    LoanTakenError,
    NoLoanError,
    NotEnoughMoneyError,
    Recap,
    TradingPeriod,
    WorkshopSession,
)

WORKSHOP_CONFIG = InstanceConfig.model_validate(
    {
        "name": "Workshop",
        "advertised": False,
        "starts_at": "2026-03-01T00:00:00Z",
        "run": {"mode": "workshop"},
    }
)

# Enough to keep the grid up for one player, so that no blackout resets their cash.
FLEET = [
    OwnedFacility(facility=FacilityId.COMBINED_CYCLE, built_round=1),
    OwnedFacility(facility=FacilityId.COMBINED_CYCLE, built_round=1),
    OwnedFacility(facility=FacilityId.COMBINED_CYCLE, built_round=1),
    OwnedFacility(facility=FacilityId.COMBINED_CYCLE, built_round=1),
    OwnedFacility(facility=FacilityId.ONSHORE_WIND_TURBINE, built_round=1),
]


class _Clock:
    """A clock the test moves by hand."""

    def __init__(self) -> None:
        self.now = datetime(2026, 10, 4, 9, 0, tzinfo=timezone.utc)

    def __call__(self) -> datetime:
        return self.now

    def tick(self, **elapsed: float) -> None:
        self.now += timedelta(**elapsed)


@pytest.fixture
def path(tmp_path: Path) -> Path:
    return tmp_path / "session.json"


@pytest.fixture
def clock() -> _Clock:
    return _Clock()


def _session(path: Path, clock: _Clock, *, round_count: int = 3) -> WorkshopSession:
    """A session in Round 1's Investment phase, with Alice (account 1) owning ``FLEET`` and the starting budget."""
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=round_count, clock=clock)
    account = Account(account_id=1, username="alice", pwhash="hash", email=None, created_at="")
    session.join(account).owned_facilities.extend(FLEET)
    session.advance()
    assert session.checkpoint == Investment(round=1)
    return session


def _alice(session: WorkshopSession) -> WorkshopPlayer:
    return session.network.members[1]


def _to_next(session: WorkshopSession, kind: type) -> None:
    """Advance as the facilitator does, settling each Trading period, until the session is at the next ``kind``."""
    start = session.checkpoint
    while True:
        if isinstance(session.checkpoint, TradingPeriod) and session.settled_period != session.checkpoint:
            session.advance()  # close the price-setting window
            job = session.start_settlement()
            assert job is not None
            session.finish_settlement(job, session.run_settlement(job))
        session.advance()
        if isinstance(session.checkpoint, kind) and session.checkpoint != start:
            return


# --- taking and cancelling ----------------------------------------------------------------------


def test_the_loan_adds_its_amount_to_cash_straight_away(path: Path, clock: _Clock) -> None:
    session = _session(path, clock)

    session.take_loan(1)

    assert _alice(session).money == WORKSHOP_STARTING_BUDGET + LOAN_AMOUNT
    assert _alice(session).loan == Loan(round=1)


def test_the_loan_can_be_spent_in_the_same_investment_phase(path: Path, clock: _Clock) -> None:
    session = _session(path, clock)
    reactor = FacilityId.NUCLEAR_REACTOR
    price = session.facility_price(reactor)
    _alice(session).money = price - 1.0
    with pytest.raises(NotEnoughMoneyError):
        session.select(1, reactor)

    session.take_loan(1)
    session.select(1, reactor)
    session.advance()  # close the phase
    session.buy_selections()

    assert _alice(session).money == price - 1.0 + LOAN_AMOUNT - price
    assert [owned.facility for owned in _alice(session).owned_facilities][-1] == reactor


def test_the_loan_can_be_taken_only_once(path: Path, clock: _Clock) -> None:
    session = _session(path, clock)
    session.take_loan(1)

    with pytest.raises(LoanTakenError):
        session.take_loan(1)


def test_a_cancelled_loan_can_be_taken_again(path: Path, clock: _Clock) -> None:
    session = _session(path, clock)
    session.take_loan(1)
    session.cancel_loan(1)

    session.take_loan(1)

    assert _alice(session).loan == Loan(round=1)


def test_the_loan_is_refused_outside_an_open_investment_phase(path: Path, clock: _Clock) -> None:
    session = _session(path, clock)
    clock.tick(minutes=8)

    with pytest.raises(InvestmentClosedError):
        session.take_loan(1)


def test_the_loan_is_refused_in_the_last_round(path: Path, clock: _Clock) -> None:
    session = _session(path, clock, round_count=1)

    with pytest.raises(LoanLastRoundError):
        session.take_loan(1)
    assert _alice(session).loan is None


def test_cancelling_takes_the_money_back(path: Path, clock: _Clock) -> None:
    session = _session(path, clock)
    session.take_loan(1)

    session.cancel_loan(1)

    assert _alice(session).money == WORKSHOP_STARTING_BUDGET
    assert _alice(session).loan is None


def test_cancelling_is_refused_if_the_selection_needs_the_loan(path: Path, clock: _Clock) -> None:
    session = _session(path, clock)
    session.take_loan(1)
    # A reactor costs more than the starting budget.
    session.select(1, FacilityId.NUCLEAR_REACTOR)

    with pytest.raises(LoanNeededError):
        session.cancel_loan(1)
    assert _alice(session).loan == Loan(round=1)


def test_cancelling_without_a_loan_is_refused(path: Path, clock: _Clock) -> None:
    session = _session(path, clock)

    with pytest.raises(NoLoanError):
        session.cancel_loan(1)


def test_the_loan_cannot_be_cancelled_once_the_phase_closes(path: Path, clock: _Clock) -> None:
    session = _session(path, clock)
    session.take_loan(1)
    clock.tick(minutes=8)

    with pytest.raises(InvestmentClosedError):
        session.cancel_loan(1)


def test_a_loan_from_an_earlier_round_is_final(path: Path, clock: _Clock) -> None:
    session = _session(path, clock)
    session.take_loan(1)
    _to_next(session, Investment)

    with pytest.raises(LoanFinalError):
        session.cancel_loan(1)


def test_the_loan_survives_a_restart(path: Path, clock: _Clock) -> None:
    session = _session(path, clock)
    session.take_loan(1)

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)

    assert reopened.network.members[1].loan == Loan(round=1)
    assert reopened.network.members[1].money == WORKSHOP_STARTING_BUDGET + LOAN_AMOUNT


def test_a_failed_save_undoes_the_loan(path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch) -> None:
    session = _session(path, clock)

    def failing_write(path: Path, text: str) -> None:
        raise OSError("disk full")

    monkeypatch.setattr("energetica.workshop.session.write_atomically", failing_write)
    with pytest.raises(OSError):
        session.take_loan(1)

    assert _alice(session).loan is None
    assert _alice(session).money == WORKSHOP_STARTING_BUDGET


# --- paying it back -----------------------------------------------------------------------------


def test_a_round_one_loan_is_paid_back_as_rounds_two_and_three_start(path: Path, clock: _Clock) -> None:
    session = _session(path, clock)
    alice = _alice(session)
    session.take_loan(1)
    _to_next(session, Recap)
    alice.money = 100_000_000.0

    _to_next(session, Investment)
    assert alice.money == 100_000_000.0 - LOAN_PAYMENT
    assert alice.loan == Loan(round=1, payments_made=1)

    _to_next(session, Recap)
    alice.money = 100_000_000.0
    _to_next(session, Investment)
    assert alice.money == 100_000_000.0 - LOAN_PAYMENT
    assert alice.loan == Loan(round=1, payments_made=2)

    _to_next(session, Recap)
    alice.money = 100_000_000.0
    _to_next(session, Finished)
    assert alice.money == 100_000_000.0


def test_a_loan_in_the_second_to_last_round_is_paid_at_the_last_round_and_the_session_end(
    path: Path, clock: _Clock
) -> None:
    session = _session(path, clock)
    alice = _alice(session)
    _to_next(session, Investment)
    session.take_loan(1)
    _to_next(session, Recap)
    alice.money = 100_000_000.0

    _to_next(session, Investment)
    assert session.checkpoint == Investment(round=3)
    assert alice.money == 100_000_000.0 - LOAN_PAYMENT

    _to_next(session, Recap)
    alice.money = 100_000_000.0
    _to_next(session, Finished)
    assert alice.money == 100_000_000.0 - LOAN_PAYMENT
    assert alice.loan == Loan(round=2, payments_made=2)


def test_a_payment_is_taken_before_the_cash_floor(path: Path, clock: _Clock) -> None:
    session = _session(path, clock)
    session.take_loan(1)
    _to_next(session, Recap)
    _alice(session).money = WORKSHOP_CASH_FLOOR + 5_000_000.0

    _to_next(session, Investment)

    assert _alice(session).money == WORKSHOP_CASH_FLOOR


def test_a_payment_at_the_session_end_can_take_cash_below_zero(path: Path, clock: _Clock) -> None:
    session = _session(path, clock)
    alice = _alice(session)
    _to_next(session, Investment)
    session.take_loan(1)
    _to_next(session, Investment)
    _to_next(session, Recap)
    alice.money = 5_000_000.0

    _to_next(session, Finished)

    assert alice.money == 5_000_000.0 - LOAN_PAYMENT


# --- the score ----------------------------------------------------------------------------------


def test_the_loan_counts_as_an_investment_of_its_cost(path: Path, clock: _Clock) -> None:
    session = _session(path, clock)
    alice = _alice(session)
    before = score(alice, completed_rounds=session.round_count, price_round_count=session.price_round_count)

    session.take_loan(1)
    after = score(alice, completed_rounds=session.round_count, price_round_count=session.price_round_count)

    assert LOAN_COST == 10_000_000.0
    assert after.investments == before.investments + LOAN_COST
    assert after.score == before.score - LOAN_COST


def test_the_cash_floor_covering_a_payment_leaves_the_score_unchanged(path: Path, clock: _Clock) -> None:
    session = _session(path, clock)
    alice = _alice(session)
    session.take_loan(1)
    _to_next(session, Recap)
    alice.money = 0.0
    before = score(alice, completed_rounds=session.round_count, price_round_count=session.price_round_count)

    _to_next(session, Investment)

    assert alice.money == WORKSHOP_CASH_FLOOR
    assert score(alice, completed_rounds=session.round_count, price_round_count=session.price_round_count) == before


# --- the balance sheet --------------------------------------------------------------------------


def _sheet(session: WorkshopSession, round_number: int) -> tuple[float, list[tuple[str, float, bool]]]:
    alice = _alice(session)
    sheet = balance_sheet(
        round_number,
        results=alice.trading_results,
        purchases=alice.purchases,
        settled=None,
        blackouts=[],
        loan=alice.loan,
        round_count=session.round_count,
    )
    return sheet.financing_total, [(line.kind, line.amount, line.at_session_end) for line in sheet.financing]


def test_the_balance_sheet_shows_the_loan_and_each_payment_where_it_was_taken(path: Path, clock: _Clock) -> None:
    session = _session(path, clock)
    _to_next(session, Investment)
    session.take_loan(1)
    _to_next(session, Finished)

    assert _sheet(session, 1) == (0.0, [])
    assert _sheet(session, 2) == (LOAN_AMOUNT, [("loan", LOAN_AMOUNT, False)])
    assert _sheet(session, 3) == (
        -2 * LOAN_PAYMENT,
        [("loan_payment", -LOAN_PAYMENT, False), ("loan_payment", -LOAN_PAYMENT, True)],
    )
