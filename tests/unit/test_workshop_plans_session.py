"""Unit tests for Round plans in a Workshop session (#1190): each Round's levers and events, locked a Round ahead."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from energetica.identity.accounts import Account
from energetica.identity.instance_config import InstanceConfig
from energetica.workshop.events import FiredEvent, InvalidPickError
from energetica.workshop.facilities import FacilityId
from energetica.workshop.round_format import RoundFormat
from energetica.workshop.round_plan import (
    DEFAULT_PLAN,
    InvalidLeversError,
    LeverChanges,
    PlannedEvent,
    plans_from,
)
from energetica.workshop.session import (
    Investment,
    NoEventsInRoundOneError,
    NoSuchRoundError,
    PhaseTimers,
    Recap,
    RoundLockedError,
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

FULL_SEASON = RoundFormat(trading_format="full_season", storage="all")


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


def test_each_round_starts_with_its_own_copy_of_the_default_plan(path: Path) -> None:
    session = _session(path, round_count=4)

    assert session.plans == plans_from(DEFAULT_PLAN, round_count=4)


def test_no_round_is_locked_before_the_session_starts(path: Path) -> None:
    session = _session(path)

    assert session.locked_rounds() == 0
    session.set_levers(1, LeverChanges(fuel_procurement="manual"))
    assert session.current_format() == RoundFormat()
    assert session.fuel_procurement == "manual"


def test_round_one_locks_when_the_session_starts_and_the_next_round_at_each_recap(path: Path) -> None:
    session = _session(path)
    session.advance()
    assert session.locked_rounds() == 1
    with pytest.raises(RoundLockedError):
        session.set_levers(1, LeverChanges(fuel_procurement="manual"))
    session.set_levers(2, LeverChanges(fuel_procurement="manual"))

    _keep_the_lights_on(session)
    _to_next(session, Recap)
    assert session.locked_rounds() == 2
    with pytest.raises(RoundLockedError):
        session.set_levers(2, LeverChanges(storage="off"))
    with pytest.raises(RoundLockedError):
        session.plan_event(2, PlannedEvent(event="demand.recession", severity="base"))
    assert session.plans[1].levers.fuel_procurement == "manual"
    session.set_levers(3, LeverChanges(storage="off"))

    _to_next(session, Recap)  # Recap 2
    assert session.locked_rounds() == 3
    _to_next(session, Recap)  # Recap 3, the last
    assert session.locked_rounds() == 3


def test_a_round_the_session_does_not_have_is_refused(path: Path) -> None:
    session = _session(path)

    for round_number in (0, 4):
        with pytest.raises(NoSuchRoundError):
            session.set_levers(round_number, LeverChanges())
        with pytest.raises(NoSuchRoundError):
            session.plan_event(round_number, PlannedEvent(event="demand.recession", severity="base"))


def test_a_lever_change_carries_to_every_later_round_and_survives_a_restart(path: Path) -> None:
    session = _session(path, round_count=4)

    session.set_levers(2, LeverChanges(trading_format="full_season", storage="all"))

    expected = [RoundFormat(), FULL_SEASON, FULL_SEASON, FULL_SEASON]
    assert [plan.levers.round_format for plan in session.plans] == expected
    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path)
    assert reopened.plans == session.plans


def test_a_lever_change_that_would_leave_a_later_round_invalid_is_refused(path: Path) -> None:
    session = _session(path, round_count=3)
    session.set_levers(2, LeverChanges(trading_format="full_season"))
    session.set_levers(3, LeverChanges(storage="all"))
    plans = session.plans

    with pytest.raises(InvalidLeversError) as refused:
        session.set_levers(2, LeverChanges(trading_format="representative_week"))

    assert refused.value.round_number == 3
    assert session.plans == plans
    assert WorkshopSession.open(WORKSHOP_CONFIG, path).plans == plans


def test_each_round_runs_with_its_own_levers(path: Path) -> None:
    session = _session(path)
    session.set_levers(2, LeverChanges(clearings_per_day=96, fuel_procurement="manual"))
    session.advance()
    _keep_the_lights_on(session)

    _to_next(session, TradingPeriod)
    assert session.current_format() == RoundFormat()
    assert session.fuel_procurement == "automatic"
    _to_next(session, Investment)
    assert session.current_format() == RoundFormat(clearings_per_day=96)
    _to_next(session, TradingPeriod)
    assert session.fuel_procurement == "manual"


def test_the_timers_stay_live_and_apply_to_the_next_phase_that_opens(path: Path) -> None:
    session = _session(path)
    session.set_timers(PhaseTimers(investment_minutes=3, price_setting_minutes=2))
    session.advance()
    assert session.phase_timer is not None
    assert session.phase_timer.duration == timedelta(minutes=3)

    session.set_timers(PhaseTimers(investment_minutes=3, price_setting_minutes=7))
    _keep_the_lights_on(session)
    session.advance()  # close the Investment phase
    session.advance()
    assert session.phase_timer is not None
    assert session.phase_timer.duration == timedelta(minutes=7)
    assert WorkshopSession.open(WORKSHOP_CONFIG, path).timers == session.timers


def test_round_one_holds_no_events(path: Path) -> None:
    session = _session(path)

    with pytest.raises(NoEventsInRoundOneError):
        session.plan_event(1, PlannedEvent(event="climate.flood", severity="major", season="spring"))
    assert session.plans[0].events == []


def test_an_event_planned_without_the_season_it_needs_is_refused(path: Path) -> None:
    session = _session(path)

    with pytest.raises(InvalidPickError):
        session.plan_event(2, PlannedEvent(event="climate.flood", severity="major"))


def test_planned_events_fire_at_their_round_and_season_and_never_carry(path: Path) -> None:
    session = _session(path)
    flood = PlannedEvent(event="climate.flood", severity="major", season="summer")
    recession = PlannedEvent(event="demand.recession", severity="base")
    assert session.plan_event(2, flood)
    assert session.plan_event(2, recession)
    assert not session.plan_event(2, recession)
    session.advance()
    _keep_the_lights_on(session)

    _to_next(session, Investment)  # Round 2
    assert session.fired_events == [FiredEvent.of(recession, round_number=2, season=None)]
    _to_next(session, TradingPeriod)  # spring
    _to_next(session, TradingPeriod)  # summer
    assert session.fired_events[-1] == FiredEvent.of(flood, round_number=2, season="summer")
    _to_next(session, Investment)  # Round 3
    assert len(session.fired_events) == 2
    assert session.plans[2].events == []
    assert [status for _, status in session.plans_view().statuses[1]] == ["fired", "fired"]


def test_a_planned_event_can_be_dropped_before_its_round_locks(path: Path) -> None:
    session = _session(path)
    session.plan_event(2, PlannedEvent(event="climate.flood", severity="major", season="summer"))

    assert not session.unplan_event(2, "climate.flood", "spring")
    assert session.unplan_event(2, "climate.flood", "summer")
    assert session.plans[1].events == []


def test_an_event_planned_for_a_season_after_a_blackout_still_fires(path: Path) -> None:
    session = _session(path, round_count=2, players=1)
    flood = PlannedEvent(event="climate.flood", severity="major", season="summer")
    session.plan_event(2, flood)
    session.advance()
    _keep_the_lights_on(session)
    _to_next(session, Recap)
    # Take the player's facilities away: with nothing to meet the demand, the grid goes down in spring.
    session.network.members[1].owned_facilities = []

    _to_next(session, TradingPeriod)  # Round 2's spring
    session.advance()  # close the price-setting window
    job = session.start_settlement()
    assert job is not None
    session.finish_settlement(job, session.run_settlement(job))
    assert {blackout.season for blackout in session.blackouts if blackout.round == 2} == {"spring"}
    session.advance()

    assert session.checkpoint == TradingPeriod(round=2, season="summer")
    assert session.plans_view().statuses[1] == [(flood, "fired")]


def test_picks_the_catalog_no_longer_allows_are_dropped_on_restart(path: Path) -> None:
    session = _session(path)
    session.plan_event(2, PlannedEvent(event="climate.flood", severity="major", season="summer"))
    # The flood has no minor severity, as if a catalog edit had removed the one planned.
    path.write_text(path.read_text().replace('"major"', '"minor"'))

    assert WorkshopSession.open(WORKSHOP_CONFIG, path).plans[1].events == []
