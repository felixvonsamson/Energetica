"""Unit tests for adding a Round to a running Workshop session (#1298)."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from energetica.identity.accounts import Account
from energetica.identity.instance_config import InstanceConfig
from energetica.workshop.facilities import FacilityId, session_price
from energetica.workshop.loan import LOAN_PAYMENT
from energetica.workshop.round_format import RoundFormat
from energetica.workshop.round_plan import LeverChanges, PlannedEvent
from energetica.workshop.session import (
    Finished,
    Investment,
    LastRecapOpenError,
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

# These tests play several Rounds with a small fleet, so grown demand would black them out (#1226).
pytestmark = pytest.mark.usefixtures("no_demand_growth")


class _Clock:
    """A clock that never moves: every window stays open until the facilitator closes it."""

    def __init__(self) -> None:
        self.now = datetime(2026, 10, 4, 9, 0, tzinfo=timezone.utc)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def path(tmp_path: Path) -> Path:
    return tmp_path / "session.json"


def _session(path: Path, *, round_count: int = 3, players: int = 2) -> WorkshopSession:
    """A session before Round 1, with ``players`` players who each hold plenty of money and own nothing yet."""
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=round_count, clock=_Clock())
    for account_id in range(1, players + 1):
        account = Account(account_id=account_id, username=f"p{account_id}", pwhash="hash", email=None, created_at="")
        session.join(account).money = 1_000_000_000.0
    return session


def _keep_the_lights_on(session: WorkshopSession) -> None:
    """In an Investment phase, have every player pick enough coal burners to meet the demand."""
    for player in session.network.players():
        for _ in range(6):
            session.select(player.account_id, FacilityId.COAL_BURNER)


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


def test_an_added_round_is_played_before_the_session_finishes(path: Path) -> None:
    session = _session(path, round_count=1)
    session.advance()
    _keep_the_lights_on(session)

    session.add_round()

    assert session.round_count == 2
    _to_next(session, Recap)
    assert session.recap(1).round_count == 2
    session.advance()
    assert session.checkpoint == Investment(round=2)
    _to_next(session, Recap)
    session.advance()
    assert session.checkpoint == Finished()


def test_the_added_round_copies_the_last_rounds_levers_without_its_events(path: Path) -> None:
    session = _session(path, round_count=2)
    session.set_levers(2, LeverChanges(trading_format="full_season", storage="all", fuel_procurement="manual"))
    session.plan_event(2, PlannedEvent(event="demand.recession", severity="base"))

    session.add_round()

    assert session.plans[2].levers == session.plans[1].levers
    assert session.plans[2].levers.round_format == RoundFormat(trading_format="full_season", storage="all")
    assert session.plans[2].events == []


def test_the_added_round_can_be_planned_and_survives_a_restart(path: Path) -> None:
    session = _session(path, round_count=1)
    session.advance()
    session.add_round()

    assert session.locked_rounds() == 1
    session.plan_event(2, PlannedEvent(event="demand.recession", severity="base"))

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=_Clock())
    assert reopened.round_count == 2
    assert reopened.plans == session.plans


def test_no_round_can_be_added_once_the_last_recap_opens(path: Path) -> None:
    session = _session(path, round_count=1)
    session.advance()
    _keep_the_lights_on(session)
    _to_next(session, Recap)

    with pytest.raises(LastRecapOpenError):
        session.add_round()
    session.advance()
    with pytest.raises(LastRecapOpenError):
        session.add_round()
    assert session.round_count == 1


def test_prices_stay_those_of_the_length_the_session_started_with(path: Path) -> None:
    session = _session(path, round_count=3)
    session.advance()
    nuclear = session.facility_price(FacilityId.NUCLEAR_REACTOR)

    session.add_round()

    assert nuclear == session_price(FacilityId.NUCLEAR_REACTOR, 3)
    assert nuclear != session_price(FacilityId.NUCLEAR_REACTOR, 4)
    assert session.facility_price(FacilityId.NUCLEAR_REACTOR) == nuclear
    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=_Clock())
    assert reopened.facility_price(FacilityId.NUCLEAR_REACTOR) == nuclear


def test_a_round_added_before_the_session_starts_prices_for_the_new_length(path: Path) -> None:
    session = _session(path, round_count=3)

    session.add_round()

    assert session.facility_price(FacilityId.NUCLEAR_REACTOR) == session_price(FacilityId.NUCLEAR_REACTOR, 4)


def test_residual_value_keeps_the_price_the_session_started_with(path: Path) -> None:
    session = _session(path, round_count=3, players=1)
    session.advance()
    _keep_the_lights_on(session)
    session.select(1, FacilityId.NUCLEAR_REACTOR)
    _to_next(session, Recap)
    before = session.scoreboard().scores[0].residual_value

    session.add_round()

    # The facilities have the same lifetime left after Round 1, so only a change of price could move the value.
    assert session.scoreboard().scores[0].residual_value == before


def test_a_loan_payment_due_after_the_old_end_is_taken_as_the_added_round_starts(path: Path) -> None:
    session = _session(path, round_count=3, players=1)
    _to_next(session, Investment)  # Round 1
    _keep_the_lights_on(session)
    _to_next(session, Investment)  # Round 2
    session.take_loan(1)
    _to_next(session, Investment)  # Round 3, which takes the first payment
    session.add_round()

    _to_next(session, Recap)  # Recap 3
    money = session.network.members[1].money
    session.advance()  # Round 4
    player = session.network.members[1]
    assert player.loan is not None and player.loan.payments_made == 2
    assert player.money == money - LOAN_PAYMENT


def test_the_loan_can_be_taken_in_what_was_the_last_round(path: Path) -> None:
    session = _session(path, round_count=1)
    session.advance()

    session.add_round()

    session.take_loan(1)
    assert session.network.members[1].loan is not None
