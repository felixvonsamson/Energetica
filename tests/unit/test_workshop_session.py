"""Unit tests for a Workshop Run's session state (#994): the moderator-paced state machine that runs
Round → Investment → four Trading periods → Recap, and the saved copy that lets it survive a restart.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from energetica.identity.accounts import Account
from energetica.identity.instance_config import InstanceConfig
from energetica.workshop.facilities import FacilityId
from energetica.workshop.fleet import OwnedFacility
from energetica.workshop.phase_timer import PhaseTimer
from energetica.workshop.session import (
    SEASONS,
    Checkpoint,
    Finished,
    Investment,
    NoPhaseRunningError,
    NotStarted,
    Recap,
    SessionFinishedError,
    TradingPeriod,
    WorkshopSession,
    next_checkpoint,
)
from energetica.workshop import session as session_module
from energetica.workshop.setup import NotAWorkshopRunError

WORKSHOP_CONFIG = InstanceConfig.model_validate(
    {
        "name": "Workshop",
        "advertised": False,
        "starts_at": "2026-03-01T00:00:00Z",
        "run": {"mode": "workshop"},
    }
)

FREEPLAY_CONFIG = InstanceConfig.model_validate(
    {
        "name": "Persistent",
        "advertised": True,
        "starts_at": "2026-03-01T00:00:00Z",
        "access": {"policy": "public"},
        "run": {"mode": "freeplay"},
    }
)


def _account(account_id: int, username: str) -> Account:
    return Account(account_id=account_id, username=username, pwhash="hash", email=None, created_at="")


def _one_round(round_number: int) -> list[Checkpoint]:
    return [
        Investment(round=round_number),
        *(TradingPeriod(round=round_number, season=season) for season in SEASONS),
        Recap(round=round_number),
    ]


# --- the state machine ----------------------------------------------------------------------


def test_seasons_run_spring_to_winter() -> None:
    assert SEASONS == ("spring", "summer", "autumn", "winter")


def test_advancing_walks_every_round_in_order_and_then_finishes() -> None:
    checkpoint: Checkpoint = NotStarted()
    visited = []
    while not isinstance(checkpoint, Finished):
        checkpoint = next_checkpoint(checkpoint, round_count=2)
        visited.append(checkpoint)

    assert visited == [*_one_round(1), *_one_round(2), Finished()]


def test_a_single_round_session_finishes_after_its_recap() -> None:
    assert next_checkpoint(Recap(round=1), round_count=1) == Finished()


def test_nothing_follows_the_end_of_the_session() -> None:
    with pytest.raises(SessionFinishedError):
        next_checkpoint(Finished(), round_count=3)


# --- the session ----------------------------------------------------------------------------


@pytest.fixture
def path(tmp_path: Path) -> Path:
    return tmp_path / "workshop_session.json"


def test_a_new_session_waits_for_the_moderator_before_round_one(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)

    assert session.checkpoint == NotStarted()
    assert session.network.players() == []


def test_opening_rejects_a_freeplay_run(path: Path) -> None:
    with pytest.raises(NotAWorkshopRunError):
        WorkshopSession.open(FREEPLAY_CONFIG, path)


def test_the_session_sits_at_its_checkpoint_until_advanced(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    session.advance()

    session.join(_account(1, "alice"))

    assert session.checkpoint == Investment(round=1)


def test_an_empty_round_advances_through_to_recap_and_into_round_two(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=2)

    visited = [session.advance() for _ in range(7)]

    assert visited == [*_one_round(1), Investment(round=2)]
    assert session.checkpoint == Investment(round=2)


def test_advancing_past_the_end_raises_and_leaves_the_session_finished(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=1)
    for _ in range(7):
        session.advance()
    assert session.checkpoint == Finished()

    with pytest.raises(SessionFinishedError):
        session.advance()
    assert session.checkpoint == Finished()


def test_joins_land_in_the_one_shared_network(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)

    alice = session.join(_account(1, "alice"))
    bob = session.join(_account(2, "bob"))

    assert session.network.players() == [alice, bob]
    assert alice.network is bob.network is session.network


def test_round_count_must_be_positive(path: Path) -> None:
    with pytest.raises(ValueError):
        WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=0)


# --- surviving a restart --------------------------------------------------------------------


def test_the_checkpoint_survives_a_restart(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=2)
    for _ in range(3):
        session.advance()

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path)

    assert reopened.checkpoint == TradingPeriod(round=1, season="summer")
    assert reopened.round_count == 2


def test_players_survive_a_restart(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    alice = session.join(_account(1, "alice"))
    alice.money = 123.0
    session.join(_account(2, "bob"))
    session.advance()

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path)

    players = reopened.network.players()
    assert [(p.account_id, p.username, p.money) for p in players] == [(1, "alice", 123.0), (2, "bob", 25_000.0)]
    assert all(player.network is reopened.network for player in players)


def test_owned_facilities_survive_a_restart(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    alice = session.join(_account(1, "alice"))
    owned = [
        OwnedFacility(facility=FacilityId.ONSHORE_WIND_TURBINE, built_round=1),
        OwnedFacility(facility=FacilityId.NUCLEAR_REACTOR, built_round=1),
    ]
    alice.owned_facilities.extend(owned)
    session.join(_account(2, "bob"))
    session.advance()

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path)

    assert [player.owned_facilities for player in reopened.network.players()] == [owned, []]


def test_a_rejoin_after_a_restart_returns_the_saved_player(path: Path) -> None:
    WorkshopSession.open(WORKSHOP_CONFIG, path).join(_account(1, "alice"))

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path)
    player = reopened.join(_account(1, "alice"))

    assert reopened.network.players() == [player]


def test_the_round_count_given_on_reopening_does_not_override_the_saved_one(path: Path) -> None:
    WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=2)

    assert WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=5).round_count == 2


def test_an_unreadable_saved_session_fails_loudly_rather_than_starting_over(path: Path) -> None:
    """Starting a fresh session over a broken file would silently throw away a running session."""
    path.write_text("{not json", encoding="utf-8")

    with pytest.raises(ValueError):
        WorkshopSession.open(WORKSHOP_CONFIG, path)


def test_a_session_is_saved_as_soon_as_it_is_opened(path: Path) -> None:
    WorkshopSession.open(WORKSHOP_CONFIG, path)

    assert path.exists()


def test_a_failed_save_leaves_the_checkpoint_where_it_was(path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    monkeypatch.setattr(session_module, "_write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.advance()

    assert session.checkpoint == NotStarted()


def test_a_failed_save_undoes_the_join(path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    monkeypatch.setattr(session_module, "_write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.join(_account(1, "alice"))

    assert session.network.players() == []


def _failing_write(path: Path, text: str) -> None:
    raise OSError("disk full")


# --- phase timers (#996) --------------------------------------------------------------------


class _Clock:
    """A clock the test moves by hand."""

    def __init__(self) -> None:
        self.now = datetime(2026, 10, 4, 9, 0, tzinfo=timezone.utc)

    def __call__(self) -> datetime:
        return self.now

    def tick(self, **elapsed: float) -> None:
        self.now += timedelta(**elapsed)


@pytest.fixture
def clock() -> _Clock:
    return _Clock()


def test_no_phase_is_timed_before_the_session_starts(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)

    assert session.phase_timer is None


def test_the_investment_phase_opens_with_eight_minutes(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)

    session.advance()

    assert session.phase_timer == PhaseTimer(started_at=clock.now, duration=timedelta(minutes=8))


def test_each_trading_period_opens_its_own_five_minute_price_setting_window(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    session.advance()

    for _ in SEASONS:
        clock.tick(minutes=20)
        session.advance()
        assert session.phase_timer == PhaseTimer(started_at=clock.now, duration=timedelta(minutes=5))


def test_recap_and_the_end_of_the_session_are_not_timed(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=1, clock=clock)
    for _ in range(6):
        session.advance()
    assert session.checkpoint == Recap(round=1)
    assert session.phase_timer is None

    session.advance()

    assert session.checkpoint == Finished()
    assert session.phase_timer is None


def test_running_out_of_time_does_not_advance_the_session(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    session.advance()

    clock.tick(hours=5)

    assert session.checkpoint == Investment(round=1)
    assert session.phase_timer is not None
    assert not session.phase_timer.is_active(clock.now)


def test_the_moderator_extends_the_running_phase(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    session.advance()
    clock.tick(minutes=7)

    timer = session.extend_phase(timedelta(minutes=2))

    assert session.phase_timer == timer
    assert timer.remaining(clock.now) == timedelta(minutes=3)


def test_a_phase_cannot_be_extended_when_none_is_running(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)

    with pytest.raises(NoPhaseRunningError):
        session.extend_phase(timedelta(minutes=1))


def test_a_phase_that_has_closed_cannot_be_extended(path: Path, clock: _Clock) -> None:
    """Once a window closes its results may be computed, so reopening it is not allowed."""
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    session.advance()
    clock.tick(minutes=8)

    with pytest.raises(NoPhaseRunningError):
        session.extend_phase(timedelta(minutes=1))
    assert session.phase_timer == PhaseTimer(started_at=clock.now - timedelta(minutes=8), duration=timedelta(minutes=8))


def test_advancing_drops_the_previous_phases_extensions(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    session.advance()
    session.extend_phase(timedelta(minutes=4))

    session.advance()

    assert session.phase_timer is not None
    assert session.phase_timer.extensions == ()


def test_a_phase_timer_and_its_extensions_survive_a_restart(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    session.advance()
    session.extend_phase(timedelta(minutes=2))

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)

    assert reopened.phase_timer == session.phase_timer


def test_a_session_saved_before_phase_timers_existed_still_opens(path: Path) -> None:
    path.write_text(
        '{"checkpoint": {"kind": "recap", "round": 1}, "round_count": 3, "levers": {}, "players": []}',
        encoding="utf-8",
    )

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path)

    assert reopened.checkpoint == Recap(round=1)
    assert reopened.phase_timer is None


def test_a_failed_save_leaves_the_phase_unextended(path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    session.advance()
    before = session.phase_timer
    monkeypatch.setattr(session_module, "_write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.extend_phase(timedelta(minutes=1))

    assert session.phase_timer == before
