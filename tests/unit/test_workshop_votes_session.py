"""Unit tests for carbon tax votes in a Workshop session (#1014): proposed in a Round's plan, cast in its Investment
phase, and told when it closes.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from energetica.identity.accounts import Account
from energetica.identity.instance_config import InstanceConfig
from energetica.workshop.facilities import FacilityId
from energetica.workshop.round_plan import LeverChanges, with_levers
from energetica.workshop.session import (
    CarbonTaxPassedError,
    Investment,
    InvestmentClosedError,
    NoVoteError,
    NoVoteInRoundOneError,
    Recap,
    TradingPeriod,
    WorkshopSession,
)
from energetica.workshop.carbon_tax import construction_emissions
from energetica.workshop.votes import CARBON_TAX_RATE, VoteOutcome

WORKSHOP_CONFIG = InstanceConfig.model_validate(
    {
        "name": "Workshop",
        "advertised": False,
        "starts_at": "2026-03-01T00:00:00Z",
        "run": {"mode": "workshop"},
    }
)


class _Clock:
    """A clock the test moves by hand."""

    def __init__(self) -> None:
        self.now = datetime(2026, 10, 4, 9, 0, tzinfo=timezone.utc)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def path(tmp_path: Path) -> Path:
    return tmp_path / "session.json"


def _session(path: Path, *, round_count: int = 3, players: int = 3, clock: _Clock | None = None) -> WorkshopSession:
    """A session before Round 1, with ``players`` players who each hold plenty of money and own nothing yet."""
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=round_count, clock=clock or _Clock())
    for account_id in range(1, players + 1):
        account = Account(account_id=account_id, username=f"p{account_id}", pwhash="hash", email=None, created_at="")
        session.join(account).money = 10_000_000.0
    return session


def _keep_the_lights_on(session: WorkshopSession) -> None:
    """In an Investment phase, have every player pick enough coal burners to meet the demand."""
    for player in session.network.players():
        for _ in range(3):
            session.select(player.account_id, FacilityId.COAL_BURNER)


def _to_next(session: WorkshopSession, kind: type) -> None:
    """Advance as the moderator does, settling each Trading period, until the session is at the next ``kind``."""
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


def _close_investment(session: WorkshopSession) -> None:
    """Close the Investment phase and move on to the first Trading period, as the moderator's two advances do."""
    session.advance()
    session.advance()
    assert isinstance(session.checkpoint, TradingPeriod)


def _vote_in_round_one(path: Path, *, clock: _Clock | None = None) -> WorkshopSession:
    """A session in Round 1's Investment phase, which holds a vote.

    The facilitator cannot propose a vote for Round 1, but a default plan could, and it keeps the tests short.
    """
    session = _session(path, clock=clock)
    session.plans = with_levers(session.plans, 1, LeverChanges(carbon_tax_vote=True))
    session.advance()
    return session


def test_a_round_holds_a_vote_when_its_plan_proposes_one(path: Path) -> None:
    session = _vote_in_round_one(path)

    assert session.vote_held()
    session.cast_ballot(1, "yes")
    assert session.ballot(1) == "yes"


def test_the_facilitator_cannot_propose_a_vote_for_round_one(path: Path) -> None:
    session = _session(path)

    with pytest.raises(NoVoteInRoundOneError):
        session.set_levers(1, LeverChanges(carbon_tax_vote=True))
    session.set_levers(1, LeverChanges(carbon_tax_vote=False))


def test_a_round_whose_plan_proposes_no_vote_refuses_a_ballot(path: Path) -> None:
    session = _session(path)
    session.advance()

    assert not session.vote_held()
    with pytest.raises(NoVoteError):
        session.cast_ballot(1, "yes")


def test_a_ballot_is_refused_once_the_investment_phase_closes(path: Path) -> None:
    clock = _Clock()
    session = _vote_in_round_one(path, clock=clock)
    clock.now += timedelta(hours=1)

    with pytest.raises(InvestmentClosedError):
        session.cast_ballot(1, "yes")


def test_a_player_can_change_their_ballot_while_the_phase_is_open(path: Path) -> None:
    session = _vote_in_round_one(path)
    session.cast_ballot(1, "yes")
    session.cast_ballot(1, "no")

    assert session.ballot(1) == "no"


def test_the_vote_passes_when_the_investment_phase_closes_with_more_yes_than_no(path: Path) -> None:
    session = _vote_in_round_one(path)
    session.cast_ballot(1, "yes")
    session.cast_ballot(2, "yes")
    session.cast_ballot(3, "no")
    assert session.vote_outcomes == []

    _close_investment(session)

    assert session.vote_outcomes == [VoteOutcome(round=1, passed=True)]
    assert session.carbon_tax_since() == 1


def test_players_who_do_not_vote_are_not_counted(path: Path) -> None:
    session = _vote_in_round_one(path)
    session.cast_ballot(1, "yes")

    _close_investment(session)

    assert session.vote_outcomes == [VoteOutcome(round=1, passed=True)]


def test_a_tie_fails(path: Path) -> None:
    session = _vote_in_round_one(path)
    session.cast_ballot(1, "yes")
    session.cast_ballot(2, "no")

    _close_investment(session)

    assert session.vote_outcomes == [VoteOutcome(round=1, passed=False)]
    assert session.carbon_tax_since() is None


def test_a_vote_nobody_casts_a_ballot_in_fails(path: Path) -> None:
    session = _vote_in_round_one(path)

    _close_investment(session)

    assert session.vote_outcomes == [VoteOutcome(round=1, passed=False)]


def test_the_ballots_are_not_kept_once_the_vote_closes(path: Path) -> None:
    session = _vote_in_round_one(path)
    session.cast_ballot(1, "yes")

    _close_investment(session)

    assert session.ballot(1) is None


def test_a_failed_vote_turns_the_lever_off_in_the_later_rounds(path: Path) -> None:
    session = _vote_in_round_one(path)

    _close_investment(session)

    assert [plan.levers.carbon_tax_vote for plan in session.plans] == [True, False, False]


def test_a_vote_turns_the_lever_off_even_where_it_was_turned_on_on_its_own(path: Path) -> None:
    session = _session(path, round_count=4)
    session.plans = with_levers(session.plans, 1, LeverChanges(carbon_tax_vote=True))
    session.plans = with_levers(session.plans, 2, LeverChanges(carbon_tax_vote=False))
    session.set_levers(3, LeverChanges(carbon_tax_vote=True))
    session.advance()

    _close_investment(session)

    assert [plan.levers.carbon_tax_vote for plan in session.plans] == [True, False, False, False]


def test_the_facilitator_can_propose_the_tax_again_after_a_failed_vote(path: Path) -> None:
    session = _vote_in_round_one(path)
    _keep_the_lights_on(session)
    _close_investment(session)

    session.set_levers(2, LeverChanges(carbon_tax_vote=True))
    _to_next(session, Investment)

    assert session.vote_held()


def test_a_passed_carbon_tax_cannot_be_proposed_again(path: Path) -> None:
    session = _vote_in_round_one(path)
    session.cast_ballot(1, "yes")
    _close_investment(session)

    assert [plan.levers.carbon_tax_vote for plan in session.plans] == [True, False, False]
    with pytest.raises(CarbonTaxPassedError):
        session.set_levers(2, LeverChanges(carbon_tax_vote=True))
    # Other levers still change.
    session.set_levers(2, LeverChanges(fuel_procurement="manual"))


def test_a_passed_carbon_tax_stays_in_force_for_the_rest_of_the_session(path: Path) -> None:
    session = _vote_in_round_one(path)
    session.cast_ballot(1, "yes")
    _keep_the_lights_on(session)
    _close_investment(session)

    _to_next(session, Investment)

    assert session.carbon_tax_since() == 1
    assert not session.vote_held()


def test_the_vote_and_its_ballots_survive_a_restart(path: Path) -> None:
    session = _vote_in_round_one(path)
    session.cast_ballot(1, "yes")

    reloaded = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=_Clock())
    assert reloaded.ballot(1) == "yes"

    _close_investment(reloaded)
    again = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=_Clock())
    assert again.vote_outcomes == [VoteOutcome(round=1, passed=True)]


def test_the_recap_announces_a_vote_planned_for_the_next_round(path: Path) -> None:
    session = _session(path)
    session.set_levers(2, LeverChanges(carbon_tax_vote=True))
    session.advance()
    _keep_the_lights_on(session)

    _to_next(session, Recap)

    year_ahead = session.recap(1).year_ahead
    assert year_ahead is not None
    assert year_ahead.carbon_tax_vote is not None


def test_the_recap_announces_no_vote_when_none_is_planned(path: Path) -> None:
    session = _session(path)
    session.advance()
    _keep_the_lights_on(session)

    _to_next(session, Recap)

    year_ahead = session.recap(1).year_ahead
    assert year_ahead is not None
    assert year_ahead.carbon_tax_vote is None


def _settle_period(session: WorkshopSession) -> None:
    """Close the current Trading period's price-setting window and settle it."""
    session.advance()
    job = session.start_settlement()
    assert job is not None
    session.finish_settlement(job, session.run_settlement(job))


def test_a_passed_carbon_tax_is_settled_each_trading_period_and_shared_out(path: Path) -> None:
    session = _vote_in_round_one(path)
    session.cast_ballot(1, "yes")
    _keep_the_lights_on(session)
    # Player 3 buys a wind turbine too, so the players differ in what they emit building.
    session.select(3, FacilityId.ONSHORE_WIND_TURBINE)
    _close_investment(session)
    players = session.network.players()
    before = {player.account_id: player.money for player in players}

    _settle_period(session)

    results = {player.account_id: player.trading_results[-1] for player in players}
    for player in players:
        result = results[player.account_id]
        assert result.carbon_tax_rate == CARBON_TAX_RATE
        assert result.construction_emissions == pytest.approx(construction_emissions(player.purchases, 1))
        assert player.money - before[player.account_id] == pytest.approx(result.net - result.carbon_tax)
    assert results[3].construction_emissions > results[1].construction_emissions
    # Everything paid comes back, shared out equally.
    assert sum(result.carbon_tax for result in results.values()) == pytest.approx(0.0, abs=1e-6)
    assert len({result.carbon_tax_share for result in results.values()}) == 1

    session.advance()
    _settle_period(session)

    assert all(player.trading_results[-1].construction_emissions == 0 for player in players)
    assert all(player.trading_results[-1].carbon_tax_share > 0 for player in players)


def test_without_a_passed_vote_no_carbon_tax_is_settled(path: Path) -> None:
    session = _vote_in_round_one(path)
    _keep_the_lights_on(session)
    _close_investment(session)

    _settle_period(session)

    for player in session.network.players():
        assert player.trading_results[-1].carbon_tax_rate == 0
        assert player.trading_results[-1].carbon_tax == 0
