"""Unit tests for the Recap in a running Workshop session (#1013): when it opens, and what it reads."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from energetica.identity.accounts import Account
from energetica.identity.instance_config import InstanceConfig
from energetica.workshop.facilities import FacilityId
from energetica.workshop.round_plan import PlannedEvent
from energetica.workshop.session import (
    NoSuchRoundError,
    Recap,
    RecapNotOpenError,
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


class _Clock:
    """A clock that never moves: every window stays open until the moderator closes it."""

    def __call__(self) -> datetime:
        return datetime(2026, 10, 4, 9, 0, tzinfo=timezone.utc)


def _session(path: Path) -> WorkshopSession:
    """A session of two Rounds in Round 1's Investment phase, in which one player picks enough coal burners and a
    wind turbine to keep the lights on.
    """
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=2, clock=_Clock())
    account = Account(account_id=1, username="p1", pwhash="hash", email=None, created_at="")
    session.join(account).money = 10_000_000.0
    session.advance()
    for _ in range(3):
        session.select(1, FacilityId.COAL_BURNER)
    session.select(1, FacilityId.ONSHORE_WIND_TURBINE)
    return session


def _to_recap(session: WorkshopSession) -> None:
    """Advance as the moderator does, settling each Trading period, until the session is at a Recap."""
    while not isinstance(session.checkpoint, Recap):
        if isinstance(session.checkpoint, TradingPeriod) and session.settled_period != session.checkpoint:
            session.advance()
            job = session.start_settlement()
            assert job is not None
            session.finish_settlement(job, session.run_settlement(job))
        session.advance()


def test_a_recap_cannot_be_read_before_it_opens(tmp_path: Path) -> None:
    session = _session(tmp_path / "session.json")
    with pytest.raises(RecapNotOpenError):
        session.recap(1)
    with pytest.raises(NoSuchRoundError):
        session.recap(3)


def test_the_recap_reports_the_round_just_played_and_the_one_coming(tmp_path: Path) -> None:
    session = _session(tmp_path / "session.json")
    session.plan_event(2, PlannedEvent(event="demand.ev_tipping_point", severity="base"))
    session.plan_event(2, PlannedEvent(event="climate.heatwave", severity="major", season="summer"))
    _to_recap(session)
    recap = session.recap(1)
    assert recap.stories == []
    assert recap.figures.energy_sold > 0
    assert recap.figures.emissions_round > 0
    assert recap.year_ahead is not None
    assert [story.event for story in recap.year_ahead.stories] == ["demand.ev_tipping_point"]
    assert [forecast.season for forecast in recap.year_ahead.forecasts] == ["summer"]
    assert recap.year_ahead.demand is not None
    assert recap.year_ahead.demand.peak_next_round == pytest.approx(recap.year_ahead.demand.peak_this_round * 1.12)
    session.advance()  # Round 2's Investment phase
    _to_recap(session)
    recap = session.recap(2)
    assert [story.event for story in recap.stories] == ["demand.ev_tipping_point", "climate.heatwave"]
    assert recap.year_ahead is None
    # An earlier Recap stays as it was told.
    assert session.recap(1).year_ahead is not None


def test_each_rounds_peak_demand_is_the_most_any_of_its_periods_cleared(tmp_path: Path) -> None:
    path = tmp_path / "session.json"
    session = _session(path)
    peaks: list[float] = []
    while not isinstance(session.checkpoint, Recap):
        if isinstance(session.checkpoint, TradingPeriod) and session.settled_period != session.checkpoint:
            session.advance()
            job = session.start_settlement()
            assert job is not None
            outcome = session.run_settlement(job)
            assert outcome.peak_demand is not None
            peaks.append(outcome.peak_demand)
            session.finish_settlement(job, outcome)
        session.advance()
    assert session.peak_demand == {1: max(peaks)}
    recap = session.recap(1)
    assert recap.year_ahead is not None
    assert recap.year_ahead.demand is not None
    assert recap.year_ahead.demand.peak_this_round == max(peaks)
    assert WorkshopSession.open(WORKSHOP_CONFIG, path, clock=_Clock()).peak_demand == {1: max(peaks)}
