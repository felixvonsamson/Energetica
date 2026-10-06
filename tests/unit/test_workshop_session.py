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
    FacilityNotOfferedError,
    Finished,
    Investment,
    InvestmentClosedError,
    NoPhaseRunningError,
    NotEnoughMoneyError,
    NotSelectedError,
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


# --- the investment selection (#999) --------------------------------------------------------


def _investing(path: Path, clock: _Clock, *, money: float = 1_000_000.0) -> WorkshopSession:
    """A session in Round 1's Investment phase, with Alice (account 1) holding ``money``."""
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    session.join(_account(1, "alice")).money = money
    session.advance()
    return session


def test_a_player_selects_facilities_during_the_investment_window_without_paying_yet(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)

    session.select(1, FacilityId.GAS_BURNER)
    session.select(1, FacilityId.GAS_BURNER)
    session.select(1, FacilityId.SMALL_WATER_DAM)

    alice = session.network.members[1]
    assert alice.selection == [FacilityId.GAS_BURNER, FacilityId.GAS_BURNER, FacilityId.SMALL_WATER_DAM]
    assert alice.money == 1_000_000.0
    assert alice.owned_facilities == []


def test_selecting_after_the_investment_timer_runs_out_is_rejected(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)
    clock.tick(minutes=8)

    with pytest.raises(InvestmentClosedError):
        session.select(1, FacilityId.GAS_BURNER)

    assert session.network.members[1].selection == []


def test_selecting_before_the_session_starts_is_rejected(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    session.join(_account(1, "alice"))

    with pytest.raises(InvestmentClosedError):
        session.select(1, FacilityId.GAS_BURNER)


def test_a_selection_cannot_cost_more_than_the_players_money(path: Path, clock: _Clock) -> None:
    # A gas burner costs 90,000 and a small water dam 65,000.
    session = _investing(path, clock, money=180_000.0)
    session.select(1, FacilityId.GAS_BURNER)
    session.select(1, FacilityId.SMALL_WATER_DAM)

    with pytest.raises(NotEnoughMoneyError):
        session.select(1, FacilityId.SMALL_WATER_DAM)

    assert session.network.members[1].selection == [FacilityId.GAS_BURNER, FacilityId.SMALL_WATER_DAM]


def test_a_selection_can_spend_every_last_coin(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock, money=180_000.0)

    session.select(1, FacilityId.GAS_BURNER)
    session.select(1, FacilityId.GAS_BURNER)

    assert session.network.members[1].selection == [FacilityId.GAS_BURNER, FacilityId.GAS_BURNER]


def test_a_facility_the_session_does_not_offer_cannot_be_selected(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)

    with pytest.raises(FacilityNotOfferedError):
        session.select(1, FacilityId.CSP_SOLAR)


def test_a_player_removes_one_copy_from_their_selection(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)
    for facility in (FacilityId.GAS_BURNER, FacilityId.SMALL_WATER_DAM, FacilityId.GAS_BURNER):
        session.select(1, facility)

    session.deselect(1, FacilityId.GAS_BURNER)

    assert session.network.members[1].selection == [FacilityId.GAS_BURNER, FacilityId.SMALL_WATER_DAM]


def test_removing_a_facility_that_is_not_selected_is_rejected(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)

    with pytest.raises(NotSelectedError):
        session.deselect(1, FacilityId.GAS_BURNER)


def test_removing_after_the_investment_timer_runs_out_is_rejected(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)
    session.select(1, FacilityId.GAS_BURNER)
    clock.tick(minutes=8)

    with pytest.raises(InvestmentClosedError):
        session.deselect(1, FacilityId.GAS_BURNER)

    assert session.network.members[1].selection == [FacilityId.GAS_BURNER]


def test_every_players_selection_is_bought_once_the_investment_timer_runs_out(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)
    session.join(_account(2, "bob")).money = 100_000.0
    session.select(1, FacilityId.GAS_BURNER)
    session.select(1, FacilityId.NUCLEAR_REACTOR)
    session.select(2, FacilityId.SMALL_WATER_DAM)
    clock.tick(minutes=8)

    assert session.buy_selections() is True

    alice, bob = session.network.members[1], session.network.members[2]
    assert alice.owned_facilities == [
        OwnedFacility(facility=FacilityId.GAS_BURNER, built_round=1),
        OwnedFacility(facility=FacilityId.NUCLEAR_REACTOR, built_round=1),
    ]
    assert alice.money == 1_000_000.0 - 90_000 - 840_000
    assert bob.owned_facilities == [OwnedFacility(facility=FacilityId.SMALL_WATER_DAM, built_round=1)]
    assert bob.money == 100_000.0 - 65_000
    assert alice.selection == bob.selection == []


def test_nothing_is_bought_while_the_investment_timer_runs(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)
    session.select(1, FacilityId.GAS_BURNER)
    clock.tick(minutes=7)

    assert session.buy_selections() is False

    assert session.network.members[1].selection == [FacilityId.GAS_BURNER]
    assert session.network.members[1].owned_facilities == []


def test_buying_twice_charges_once(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)
    session.select(1, FacilityId.GAS_BURNER)
    clock.tick(minutes=8)
    session.buy_selections()

    assert session.buy_selections() is False

    assert session.network.members[1].money == 1_000_000.0 - 90_000
    assert len(session.network.members[1].owned_facilities) == 1


@pytest.mark.parametrize("minutes_spent", [8, 3], ids=["after the timer ran out", "while the timer still runs"])
def test_advancing_out_of_the_investment_phase_buys_any_selection_left(
    path: Path, clock: _Clock, minutes_spent: int
) -> None:
    session = _investing(path, clock)
    session.select(1, FacilityId.GAS_BURNER)
    clock.tick(minutes=minutes_spent)

    session.advance()

    alice = session.network.members[1]
    assert alice.owned_facilities == [OwnedFacility(facility=FacilityId.GAS_BURNER, built_round=1)]
    assert alice.money == 1_000_000.0 - 90_000
    assert alice.selection == []


def test_a_selection_survives_a_restart(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)
    session.select(1, FacilityId.GAS_BURNER)
    session.select(1, FacilityId.SMALL_WATER_DAM)
    session.deselect(1, FacilityId.SMALL_WATER_DAM)

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)

    assert reopened.network.members[1].selection == [FacilityId.GAS_BURNER]


def test_a_purchase_survives_a_restart(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)
    session.select(1, FacilityId.GAS_BURNER)
    clock.tick(minutes=8)
    session.buy_selections()

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)

    alice = reopened.network.members[1]
    assert alice.owned_facilities == [OwnedFacility(facility=FacilityId.GAS_BURNER, built_round=1)]
    assert alice.money == 1_000_000.0 - 90_000
    assert alice.selection == []


def test_a_session_saved_before_selections_existed_still_opens(path: Path) -> None:
    path.write_text(
        '{"checkpoint": {"kind": "recap", "round": 1}, "round_count": 3, "levers": {}, '
        '"players": [{"account_id": 1, "username": "alice", "money": 5.0, "owned_facilities": []}]}',
        encoding="utf-8",
    )

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path)

    assert reopened.network.members[1].selection == []


def test_a_failed_save_undoes_the_selection_change(path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch) -> None:
    session = _investing(path, clock)
    session.select(1, FacilityId.GAS_BURNER)
    monkeypatch.setattr(session_module, "_write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.select(1, FacilityId.SMALL_WATER_DAM)
    with pytest.raises(OSError):
        session.deselect(1, FacilityId.GAS_BURNER)

    assert session.network.members[1].selection == [FacilityId.GAS_BURNER]


def test_a_failed_save_undoes_the_purchase(path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch) -> None:
    session = _investing(path, clock)
    session.select(1, FacilityId.GAS_BURNER)
    clock.tick(minutes=8)
    monkeypatch.setattr(session_module, "_write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.buy_selections()

    alice = session.network.members[1]
    assert (alice.money, alice.owned_facilities, alice.selection) == (1_000_000.0, [], [FacilityId.GAS_BURNER])


def test_an_advance_that_fails_to_save_does_not_buy_the_selection(
    path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    session = _investing(path, clock)
    session.select(1, FacilityId.GAS_BURNER)
    clock.tick(minutes=8)
    real_write = session_module._write_atomically

    def fail_to_leave_the_investment_phase(target: Path, text: str) -> None:
        # Only the write that moves the session on fails. A purchase saved on its own beforehand
        # would get through.
        if '"trading_period"' in text:
            raise OSError("disk full")
        real_write(target, text)

    monkeypatch.setattr(session_module, "_write_atomically", fail_to_leave_the_investment_phase)

    with pytest.raises(OSError):
        session.advance()
    monkeypatch.undo()

    for kept in (session, WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)):
        alice = kept.network.members[1]
        assert kept.checkpoint == Investment(round=1)
        assert (alice.money, alice.owned_facilities, alice.selection) == (1_000_000.0, [], [FacilityId.GAS_BURNER])


# --- automatic retirement (#1000) -----------------------------------------------------------

# An onshore wind turbine built in Round 1 works in Rounds 1 and 2. A nuclear reactor built in Round 1
# works from Round 2 to Round 9.
WIND = OwnedFacility(facility=FacilityId.ONSHORE_WIND_TURBINE, built_round=1)
REACTOR = OwnedFacility(facility=FacilityId.NUCLEAR_REACTOR, built_round=1)


def _owning_wind_and_reactor(path: Path) -> WorkshopSession:
    """A session at Round 2's Recap, with Alice (account 1) owning ``WIND`` and ``REACTOR``."""
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    session.join(_account(1, "alice")).owned_facilities.extend([WIND, REACTOR])
    while session.checkpoint != Recap(round=2):
        session.advance()
    return session


def test_a_facility_stays_on_the_roster_through_its_last_round(path: Path) -> None:
    session = _owning_wind_and_reactor(path)

    assert session.network.members[1].owned_facilities == [WIND, REACTOR]


def test_a_facility_retires_by_itself_the_round_after_its_lifetime_ends(path: Path) -> None:
    session = _owning_wind_and_reactor(path)

    session.advance()

    assert session.checkpoint == Investment(round=3)
    assert session.network.members[1].owned_facilities == [REACTOR]


def test_a_retirement_survives_a_restart(path: Path) -> None:
    session = _owning_wind_and_reactor(path)
    session.advance()

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path)

    assert reopened.network.members[1].owned_facilities == [REACTOR]


def test_an_advance_that_fails_to_save_retires_nothing(path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    session = _owning_wind_and_reactor(path)
    monkeypatch.setattr(session_module, "_write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.advance()

    assert session.checkpoint == Recap(round=2)
    assert session.network.members[1].owned_facilities == [WIND, REACTOR]


# --- storage reinvest-or-lose (#1001) -------------------------------------------------------

# Lithium-ion batteries last one Round, so batteries built in Round 1 retire as Round 2 starts.
BATTERIES = FacilityId.LITHIUM_ION_BATTERIES
BATTERY_CAPACITY = 3_200_000_000.0


def _batteries_retiring(path: Path, clock: _Clock) -> WorkshopSession:
    """A session in Round 2's open Investment phase. Alice (account 1) owned three batteries in Round 1,
    which held half their capacity when they retired.
    """
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    alice = session.join(_account(1, "alice"))
    alice.money = 10_000_000.0
    alice.owned_facilities.extend([OwnedFacility(facility=BATTERIES, built_round=1)] * 3)
    alice.stored_energy[BATTERIES] = 1.5 * BATTERY_CAPACITY
    while session.checkpoint != Investment(round=2):
        session.advance()
    return session


def test_retired_storage_keeps_its_energy_while_the_investment_phase_is_open(path: Path, clock: _Clock) -> None:
    session = _batteries_retiring(path, clock)

    alice = session.network.members[1]
    assert alice.owned_facilities == []
    assert alice.stored_energy == {BATTERIES: 1.5 * BATTERY_CAPACITY}


def test_storage_bought_to_replace_retired_storage_takes_its_energy(path: Path, clock: _Clock) -> None:
    session = _batteries_retiring(path, clock)
    session.select(1, BATTERIES)
    session.select(1, BATTERIES)
    clock.tick(minutes=8)

    session.buy_selections()

    assert session.network.members[1].stored_energy == {BATTERIES: 1.5 * BATTERY_CAPACITY}


def test_energy_the_replacement_cannot_hold_is_lost(path: Path, clock: _Clock) -> None:
    session = _batteries_retiring(path, clock)
    session.select(1, BATTERIES)
    clock.tick(minutes=8)

    session.buy_selections()

    assert session.network.members[1].stored_energy == {BATTERIES: pytest.approx(BATTERY_CAPACITY)}


def test_energy_is_lost_when_the_investment_phase_closes_without_a_replacement(path: Path, clock: _Clock) -> None:
    session = _batteries_retiring(path, clock)

    session.advance()

    assert session.network.members[1].stored_energy == {}


def test_stored_energy_survives_a_restart(path: Path, clock: _Clock) -> None:
    _batteries_retiring(path, clock)

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)

    assert reopened.network.members[1].stored_energy == {BATTERIES: 1.5 * BATTERY_CAPACITY}


def test_a_session_saved_before_stored_energy_existed_still_opens(path: Path) -> None:
    path.write_text(
        '{"checkpoint": {"kind": "recap", "round": 1}, "round_count": 3, "levers": {}, '
        '"players": [{"account_id": 1, "username": "alice", "money": 5.0, "owned_facilities": []}]}',
        encoding="utf-8",
    )

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path)

    assert reopened.network.members[1].stored_energy == {}


def test_a_failed_save_keeps_the_energy_that_would_be_lost(
    path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    session = _batteries_retiring(path, clock)
    monkeypatch.setattr(session_module, "_write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.advance()

    assert session.network.members[1].stored_energy == {BATTERIES: 1.5 * BATTERY_CAPACITY}
