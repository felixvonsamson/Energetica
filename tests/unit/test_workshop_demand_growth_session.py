"""Unit tests for natural demand growth in a Workshop session (#1226): when each Round's factor is worked out, how it
moves the amplitude, and that it is saved. The formula itself is tested in ``test_workshop_demand_growth.py``.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from energetica.identity.accounts import Account
from energetica.identity.instance_config import InstanceConfig
from energetica.workshop.demand_block import PER_PLAYER_BASE_AMPLITUDE
from energetica.workshop.demand_growth import growth_factor
from energetica.workshop.facilities import FacilityId
from energetica.workshop.round_plan import PlannedEvent
from energetica.workshop.session import Investment, Recap, TradingPeriod, WorkshopSession

WORKSHOP_CONFIG = InstanceConfig.model_validate(
    {
        "name": "Workshop",
        "advertised": False,
        "starts_at": "2026-03-01T00:00:00Z",
        "run": {"mode": "workshop"},
    }
)

PLAYERS = 2
BASE_AMPLITUDE = PER_PLAYER_BASE_AMPLITUDE * PLAYERS


class _Clock:
    """A clock that never moves: every window stays open until the facilitator closes it."""

    def __init__(self) -> None:
        self.now = datetime(2026, 10, 4, 9, 0, tzinfo=timezone.utc)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def path(tmp_path: Path) -> Path:
    return tmp_path / "session.json"


def _session(path: Path, *, round_count: int = 3) -> WorkshopSession:
    """A session in Round 1's Investment phase, in which two players each pick three coal burners and a wind turbine:
    enough to keep the lights on.
    """
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=round_count, clock=_Clock())
    for account_id in range(1, PLAYERS + 1):
        account = Account(account_id=account_id, username=f"p{account_id}", pwhash="hash", email=None, created_at="")
        session.join(account).money = 1_000_000_000.0
    session.advance()
    for account_id in range(1, PLAYERS + 1):
        for _ in range(3):
            session.select(account_id, FacilityId.COAL_BURNER)
        session.select(account_id, FacilityId.ONSHORE_WIND_TURBINE)
    return session


def _settle(session: WorkshopSession) -> None:
    """Close the current Trading period's price-setting window and settle it."""
    assert isinstance(session.checkpoint, TradingPeriod)
    session.advance()
    job = session.start_settlement()
    assert job is not None
    session.finish_settlement(job, session.run_settlement(job))


def _to_next(session: WorkshopSession, kind: type) -> None:
    """Advance as the facilitator does, settling each Trading period, until the session is at the next ``kind``."""
    start = session.checkpoint
    while True:
        if isinstance(session.checkpoint, TradingPeriod) and session.settled_period != session.checkpoint:
            _settle(session)
        session.advance()
        if isinstance(session.checkpoint, kind) and session.checkpoint != start:
            return


def _amplitude_for_next_settlement(session: WorkshopSession) -> float:
    """The amplitude the current Trading period is simulated with. Leaves its window closed, not settled."""
    session.advance()
    job = session.start_settlement()
    assert job is not None
    session.abandon_settlement(job)
    return job.demand_amplitude


def _average_profit(session: WorkshopSession, round_number: int) -> float:
    players = session.network.players()
    return sum(
        result.operating_profit
        for player in players
        for result in player.trading_results
        if result.round == round_number
    ) / len(players)


def test_the_growth_is_worked_out_from_the_rooms_profit_when_the_recap_opens(path: Path) -> None:
    session = _session(path)
    _to_next(session, TradingPeriod)  # winter, after spring, summer and autumn
    for _ in range(3):
        _to_next(session, TradingPeriod)
    _settle(session)
    assert session.demand_growth == {}
    session.advance()
    assert session.checkpoint == Recap(round=1)
    assert session.demand_growth == {2: pytest.approx(growth_factor(_average_profit(session, 1)))}


def test_each_round_grows_from_the_one_before(path: Path) -> None:
    session = _session(path)
    _to_next(session, Investment)  # Round 2
    _to_next(session, TradingPeriod)
    assert _amplitude_for_next_settlement(session) == pytest.approx(BASE_AMPLITUDE * session.demand_growth[2])
    _settle_from_closed_window(session)
    _to_next(session, Investment)  # Round 3
    _to_next(session, TradingPeriod)
    grown = session.demand_growth[2] * session.demand_growth[3]
    assert session.demand_growth[3] == pytest.approx(growth_factor(_average_profit(session, 2)))
    assert _amplitude_for_next_settlement(session) == pytest.approx(BASE_AMPLITUDE * grown)


def _settle_from_closed_window(session: WorkshopSession) -> None:
    job = session.start_settlement()
    assert job is not None
    session.finish_settlement(job, session.run_settlement(job))


def test_events_move_demand_on_top_of_the_growth(path: Path) -> None:
    session = _session(path)
    session.plan_event(2, PlannedEvent(event="demand.ev_tipping_point", severity="base"))
    _to_next(session, Investment)  # Round 2
    _to_next(session, TradingPeriod)
    assert _amplitude_for_next_settlement(session) == pytest.approx(BASE_AMPLITUDE * session.demand_growth[2] * 1.12)


def test_the_recap_tells_the_growth_into_the_next_round(path: Path) -> None:
    session = _session(path)
    _to_next(session, Recap)
    year_ahead = session.recap(1).year_ahead
    assert year_ahead is not None
    assert year_ahead.demand_growth == pytest.approx(session.demand_growth[2])


def test_demand_does_not_grow_after_the_last_round(path: Path) -> None:
    session = _session(path, round_count=1)
    _to_next(session, Recap)
    assert session.demand_growth == {}


def test_the_growth_survives_a_restart(path: Path) -> None:
    session = _session(path)
    _to_next(session, Recap)
    reloaded = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=_Clock())
    assert reloaded.demand_growth == session.demand_growth
    assert 2 in reloaded.demand_growth
