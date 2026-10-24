"""Unit tests for a Workshop Run's session state (#994): the facilitator-paced state machine that runs
Round → Investment → four Trading periods → Recap, and the saved copy that lets it survive a restart.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from energetica.identity.accounts import Account
from energetica.identity.instance_config import InstanceConfig
from energetica.workshop.facilities import CATALOG, FacilityId
from energetica.workshop.fleet import OwnedFacility, Purchase
from energetica.workshop.period_record import TradingPeriodRecord
from energetica.workshop.phase_timer import PhaseTimer
from energetica.workshop.prices import (
    DEFAULT_PRICES,
    PRICE_CEILING,
    PRICE_FLOOR,
    LockedPrices,
    MarketFacility,
    PlayerQuotes,
    PriceSheet,
    PriceSide,
    QuotedPrice,
)
from energetica.workshop.round_format import RoundFormat
from energetica.workshop.round_plan import LeverChanges, RoundLevers
from energetica.workshop.session import (
    SEASONS,
    Checkpoint,
    FacilityLimitReachedError,
    FacilityNotOfferedError,
    Finished,
    Investment,
    InvestmentClosedError,
    NoMarketPricesError,
    NoPhaseRunningError,
    NotEnoughMoneyError,
    NotSelectedError,
    NotStarted,
    NotStorageError,
    PriceAboveCeilingError,
    PriceBelowFloorError,
    PriceSettingClosedError,
    Recap,
    SessionFinishedError,
    SettlementCancelledError,
    SettlementProgress,
    SettlementRunningError,
    TradingPeriod,
    WorkshopSession,
    completed_rounds,
    next_checkpoint,
)
from energetica.workshop import session as session_module
from energetica.workshop.setup import NotAWorkshopRunError
from energetica.workshop.demand_block import (
    PER_PLAYER_BASE_AMPLITUDE,
    SettlementPeriod,
    national_demand_curve,
    nominal_demand,
    round_one_amplitude,
)
from energetica.workshop.score import ranked, score
from energetica.workshop.fleet import lifetime_left, om_owed
from energetica.workshop.unlocks import Unlock
from energetica.workshop.player import WORKSHOP_CASH_FLOOR, WORKSHOP_STARTING_BUDGET, WorkshopPlayer
from energetica.workshop.seasons import representative_week
from energetica.workshop.trading import RATIONING, Bidder, TradingOutcome, demand_scale, simulate_trading_period
from energetica.workshop.blackout import Blackout
from energetica.workshop.demand_growth import growth_factor
from energetica.workshop.operating_profit import round_operating_profit
from energetica.workshop.weather import representative_weather

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


def _settle(session: WorkshopSession) -> bool:
    """Settle the Trading period if its window has closed, as the app does in the background, and return
    whether it did.
    """
    job = session.start_settlement()
    if job is None:
        return False
    try:
        outcome = session.run_settlement(job)
    except BaseException:
        session.abandon_settlement(job)
        raise
    session.finish_settlement(job, outcome)
    return True


def _advance(session: WorkshopSession) -> Checkpoint:
    """Move on to the next checkpoint as the facilitator does: advance once to close a window that is still
    open, wait for a Trading period to be settled, and advance again.
    """
    if session.phase_timer is not None and session.phase_timer.is_active(session.clock()):
        session.advance()
    if isinstance(session.checkpoint, TradingPeriod):
        _settle(session)
    return session.advance()


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


def test_a_new_session_waits_for_the_facilitator_before_round_one(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)

    assert session.checkpoint == NotStarted()
    assert session.network.players() == []


def test_opening_rejects_a_freeplay_run(path: Path) -> None:
    with pytest.raises(NotAWorkshopRunError):
        WorkshopSession.open(FREEPLAY_CONFIG, path)


def test_the_session_sits_at_its_checkpoint_until_advanced(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    _advance(session)

    session.join(_account(1, "alice"))

    assert session.checkpoint == Investment(round=1)


def test_an_empty_round_advances_through_to_recap_and_into_round_two(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=2)

    visited = [_advance(session) for _ in range(7)]

    assert visited == [*_one_round(1), Investment(round=2)]
    assert session.checkpoint == Investment(round=2)


def test_advancing_past_the_end_raises_and_leaves_the_session_finished(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=1)
    for _ in range(7):
        _advance(session)
    assert session.checkpoint == Finished()

    with pytest.raises(SessionFinishedError):
        _advance(session)
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
        _advance(session)

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path)

    assert reopened.checkpoint == TradingPeriod(round=1, season="summer")
    assert reopened.round_count == 2


def test_players_survive_a_restart(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    alice = session.join(_account(1, "alice"))
    alice.money = 123.0
    session.join(_account(2, "bob"))
    _advance(session)

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path)

    players = reopened.network.players()
    assert [(p.account_id, p.username, p.money) for p in players] == [(1, "alice", 123.0), (2, "bob", 50_000_000.0)]
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
    _advance(session)

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
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

    with pytest.raises(OSError):
        _advance(session)

    assert session.checkpoint == NotStarted()


def test_a_failed_save_undoes_the_join(path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

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

    _advance(session)

    assert session.phase_timer == PhaseTimer(started_at=clock.now, duration=timedelta(minutes=8))


def test_each_trading_period_opens_its_own_five_minute_price_setting_window(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    _advance(session)

    for _ in SEASONS:
        clock.tick(minutes=20)
        _advance(session)
        assert session.phase_timer == PhaseTimer(started_at=clock.now, duration=timedelta(minutes=5))


def test_recap_and_the_end_of_the_session_are_not_timed(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=1, clock=clock)
    for _ in range(6):
        _advance(session)
    assert session.checkpoint == Recap(round=1)
    assert session.phase_timer is None

    _advance(session)

    assert session.checkpoint == Finished()
    assert session.phase_timer is None


def test_running_out_of_time_does_not_advance_the_session(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    _advance(session)

    clock.tick(hours=5)

    assert session.checkpoint == Investment(round=1)
    assert session.phase_timer is not None
    assert not session.phase_timer.is_active(clock.now)


def test_the_facilitator_extends_the_running_phase(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    _advance(session)
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
    _advance(session)
    clock.tick(minutes=8)

    with pytest.raises(NoPhaseRunningError):
        session.extend_phase(timedelta(minutes=1))
    assert session.phase_timer == PhaseTimer(started_at=clock.now - timedelta(minutes=8), duration=timedelta(minutes=8))


def test_advancing_drops_the_previous_phases_extensions(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    _advance(session)
    session.extend_phase(timedelta(minutes=4))

    _advance(session)

    assert session.phase_timer is not None
    assert session.phase_timer.extensions == ()


def test_a_phase_timer_and_its_extensions_survive_a_restart(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    _advance(session)
    session.extend_phase(timedelta(minutes=2))

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)

    assert reopened.phase_timer == session.phase_timer


def test_a_failed_save_leaves_the_phase_unextended(path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    _advance(session)
    before = session.phase_timer
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.extend_phase(timedelta(minutes=1))

    assert session.phase_timer == before


# --- the investment selection (#999) --------------------------------------------------------


def _investing(path: Path, clock: _Clock, *, money: float = 200_000_000.0) -> WorkshopSession:
    """A session in Round 1's Investment phase, with Alice (account 1) holding ``money``."""
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    session.join(_account(1, "alice")).money = money
    _advance(session)
    return session


def test_a_player_selects_facilities_during_the_investment_window_without_paying_yet(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)

    session.select(1, FacilityId.GAS_BURNER)
    session.select(1, FacilityId.GAS_BURNER)
    session.select(1, FacilityId.SMALL_WATER_DAM)

    alice = session.network.members[1]
    assert alice.selection == [FacilityId.GAS_BURNER, FacilityId.GAS_BURNER, FacilityId.SMALL_WATER_DAM]
    assert alice.money == 200_000_000.0
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
    # A gas burner costs 8,000,000 and, in a 3-Round session, a small water dam 22,000,000.
    session = _investing(path, clock, money=40_000_000.0)
    session.select(1, FacilityId.GAS_BURNER)
    session.select(1, FacilityId.SMALL_WATER_DAM)

    with pytest.raises(NotEnoughMoneyError):
        session.select(1, FacilityId.SMALL_WATER_DAM)

    assert session.network.members[1].selection == [FacilityId.GAS_BURNER, FacilityId.SMALL_WATER_DAM]


@pytest.mark.parametrize(
    ("round_count", "reactor", "dam"),
    [(3, 53_000_000, 22_000_000), (4, 60_000_000, 25_000_000), (5, 70_000_000, 25_000_000)],
)
def test_nuclear_and_dams_are_priced_for_the_sessions_length(
    path: Path, clock: _Clock, round_count: int, reactor: float, dam: float
) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=round_count, clock=clock)

    assert session.facility_price(FacilityId.NUCLEAR_REACTOR, round_number=1) == reactor
    assert session.facility_price(FacilityId.SMALL_WATER_DAM, round_number=1) == dam
    assert session.facility_price(FacilityId.GAS_BURNER, round_number=1) == CATALOG[FacilityId.GAS_BURNER].base_price


def test_a_selection_can_spend_every_last_coin(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock, money=16_000_000.0)

    session.select(1, FacilityId.GAS_BURNER)
    session.select(1, FacilityId.GAS_BURNER)

    assert session.network.members[1].selection == [FacilityId.GAS_BURNER, FacilityId.GAS_BURNER]


# --- the dam limit (#1223) ------------------------------------------------------------------

SMALL_DAM = FacilityId.SMALL_WATER_DAM
LARGE_DAM = FacilityId.LARGE_WATER_DAM


def test_a_player_can_select_at_most_three_of_each_dam(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock, money=500_000_000.0)
    session.unlocks.append(Unlock(facility=LARGE_DAM, round=1, trigger="investment_threshold"))
    for _ in range(3):
        session.select(1, SMALL_DAM)
        session.select(1, LARGE_DAM)

    with pytest.raises(FacilityLimitReachedError):
        session.select(1, SMALL_DAM)
    with pytest.raises(FacilityLimitReachedError):
        session.select(1, LARGE_DAM)

    assert session.network.members[1].selection == [SMALL_DAM, LARGE_DAM] * 3


def test_only_dams_are_limited() -> None:
    limited = {facility.id: facility.max_owned for facility in CATALOG.values() if facility.max_owned is not None}

    assert limited == {SMALL_DAM: 3, LARGE_DAM: 3}


def test_a_facility_without_a_limit_can_be_selected_any_number_of_times(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock, money=500_000_000.0)

    for _ in range(4):
        session.select(1, FacilityId.GAS_BURNER)

    assert session.network.members[1].selection == [FacilityId.GAS_BURNER] * 4


def test_removing_a_selected_dam_frees_its_place(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)
    for _ in range(3):
        session.select(1, SMALL_DAM)

    session.deselect(1, SMALL_DAM)
    session.select(1, SMALL_DAM)

    assert session.network.members[1].selection == [SMALL_DAM] * 3


def test_dams_already_owned_count_towards_the_limit(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)
    session.network.members[1].owned_facilities.extend([OwnedFacility(facility=SMALL_DAM, built_round=1)] * 2)
    session.select(1, SMALL_DAM)

    with pytest.raises(FacilityLimitReachedError):
        session.select(1, SMALL_DAM)


def test_dams_under_construction_count_towards_the_limit(path: Path, clock: _Clock) -> None:
    # Dams have no construction lag, so one built in a later Round stands in for one still under construction.
    session = _investing(path, clock)
    under_construction = OwnedFacility(facility=SMALL_DAM, built_round=2)
    assert lifetime_left(under_construction, current_round=1).under_construction
    session.network.members[1].owned_facilities.extend([under_construction] * 3)

    with pytest.raises(FacilityLimitReachedError):
        session.select(1, SMALL_DAM)


def test_a_dam_can_be_bought_again_once_one_retires(path: Path, clock: _Clock) -> None:
    # A small dam works for 6 Rounds, so one built in Round -4 works in Round 1 and retires as Round 2 starts.
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    alice = session.join(_account(1, "alice"))
    alice.owned_facilities.extend([OwnedFacility(facility=SMALL_DAM, built_round=-4)] * 3)
    _advance(session)
    with pytest.raises(FacilityLimitReachedError):
        session.select(1, SMALL_DAM)
    while session.checkpoint != Investment(round=2):
        _advance(session)
    alice.money = 500_000_000.0

    for _ in range(3):
        session.select(1, SMALL_DAM)
    with pytest.raises(FacilityLimitReachedError):
        session.select(1, SMALL_DAM)

    assert alice.owned_facilities == []


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
    session.join(_account(2, "bob")).money = 50_000_000.0
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
    assert alice.money == 200_000_000.0 - 8_000_000 - 53_000_000  # the reactor and dam at their 3-Round prices
    assert bob.owned_facilities == [OwnedFacility(facility=FacilityId.SMALL_WATER_DAM, built_round=1)]
    assert bob.money == 50_000_000.0 - 22_000_000
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

    assert session.network.members[1].money == 200_000_000.0 - 8_000_000
    assert len(session.network.members[1].owned_facilities) == 1


def test_advancing_while_the_investment_phase_is_open_closes_it_and_stays(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)
    session.select(1, FacilityId.GAS_BURNER)
    clock.tick(minutes=3)

    assert session.advance() == Investment(round=1)

    assert not session.investment_open()
    with pytest.raises(InvestmentClosedError):
        session.select(1, FacilityId.GAS_BURNER)
    assert session.buy_selections()
    assert session.advance() == TradingPeriod(round=1, season="spring")


def test_advancing_out_of_the_investment_phase_buys_any_selection_left(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)
    session.select(1, FacilityId.GAS_BURNER)
    clock.tick(minutes=8)

    session.advance()

    alice = session.network.members[1]
    assert alice.owned_facilities == [OwnedFacility(facility=FacilityId.GAS_BURNER, built_round=1)]
    assert alice.money == 200_000_000.0 - 8_000_000
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
    assert alice.money == 200_000_000.0 - 8_000_000
    assert alice.selection == []


def test_each_purchase_is_kept_with_its_round_and_price_and_survives_a_restart(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)
    session.select(1, FacilityId.GAS_BURNER)
    session.select(1, FacilityId.GAS_BURNER)
    clock.tick(minutes=8)
    session.buy_selections()

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)

    gas = Purchase(facility=FacilityId.GAS_BURNER, round=1, price=8_000_000)
    assert reopened.network.members[1].purchases == [gas, gas]


def test_a_failed_save_undoes_the_selection_change(path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch) -> None:
    session = _investing(path, clock)
    session.select(1, FacilityId.GAS_BURNER)
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.select(1, FacilityId.SMALL_WATER_DAM)
    with pytest.raises(OSError):
        session.deselect(1, FacilityId.GAS_BURNER)

    assert session.network.members[1].selection == [FacilityId.GAS_BURNER]


def test_a_failed_save_undoes_the_purchase(path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch) -> None:
    session = _investing(path, clock)
    session.select(1, FacilityId.GAS_BURNER)
    clock.tick(minutes=8)
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.buy_selections()

    alice = session.network.members[1]
    assert (alice.money, alice.owned_facilities, alice.selection) == (200_000_000.0, [], [FacilityId.GAS_BURNER])


def test_an_advance_that_fails_to_save_does_not_buy_the_selection(
    path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    session = _investing(path, clock)
    session.select(1, FacilityId.GAS_BURNER)
    clock.tick(minutes=8)
    real_write = session_module.write_atomically

    def fail_to_leave_the_investment_phase(target: Path, text: str) -> None:
        # Only the write that moves the session on fails. A purchase saved on its own beforehand
        # would get through.
        if '"trading_period"' in text:
            raise OSError("disk full")
        real_write(target, text)

    monkeypatch.setattr(session_module, "write_atomically", fail_to_leave_the_investment_phase)

    with pytest.raises(OSError):
        _advance(session)
    monkeypatch.undo()

    for kept in (session, WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)):
        alice = kept.network.members[1]
        assert kept.checkpoint == Investment(round=1)
        assert (alice.money, alice.owned_facilities, alice.selection) == (200_000_000.0, [], [FacilityId.GAS_BURNER])


# --- automatic retirement (#1000) -----------------------------------------------------------

# A PV solar farm built in Round 1 works in Rounds 1 and 2. A nuclear reactor built in Round 1 works
# from Round 2 to Round 7.
SOLAR = OwnedFacility(facility=FacilityId.PV_SOLAR, built_round=1)
REACTOR = OwnedFacility(facility=FacilityId.NUCLEAR_REACTOR, built_round=1)


def _owning_solar_and_reactor(path: Path) -> WorkshopSession:
    """A session at Round 2's Recap, with Alice (account 1) owning ``SOLAR`` and ``REACTOR``."""
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    session.join(_account(1, "alice")).owned_facilities.extend([SOLAR, REACTOR])
    while session.checkpoint != Recap(round=2):
        _advance(session)
    return session


def test_a_facility_stays_on_the_roster_through_its_last_round(path: Path) -> None:
    session = _owning_solar_and_reactor(path)

    assert session.network.members[1].owned_facilities == [SOLAR, REACTOR]


def test_a_facility_retires_by_itself_the_round_after_its_lifetime_ends(path: Path) -> None:
    session = _owning_solar_and_reactor(path)

    _advance(session)

    assert session.checkpoint == Investment(round=3)
    assert session.network.members[1].owned_facilities == [REACTOR]


def test_a_retirement_survives_a_restart(path: Path) -> None:
    session = _owning_solar_and_reactor(path)
    _advance(session)

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path)

    assert reopened.network.members[1].owned_facilities == [REACTOR]


def test_an_advance_that_fails_to_save_retires_nothing(path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    session = _owning_solar_and_reactor(path)
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

    with pytest.raises(OSError):
        _advance(session)

    assert session.checkpoint == Recap(round=2)
    assert session.network.members[1].owned_facilities == [SOLAR, REACTOR]


# --- storage reinvest-or-lose (#1001) -------------------------------------------------------

# Lithium-ion batteries last one Round, so batteries built in Round 1 retire as Round 2 starts.
BATTERIES = FacilityId.LITHIUM_ION_BATTERIES
BATTERY_CAPACITY = CATALOG[BATTERIES].base_storage_capacity or 0.0


def _batteries_retiring(path: Path, clock: _Clock) -> WorkshopSession:
    """A session in Round 2's open Investment phase. Alice (account 1) owned three batteries in Round 1,
    which held half their capacity when they retired.
    """
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    alice = session.join(_account(1, "alice"))
    alice.owned_facilities.extend([OwnedFacility(facility=BATTERIES, built_round=1)] * 3)
    while session.checkpoint != Recap(round=1):
        _advance(session)
    # Set after Round 1's Trading periods, which charge and discharge the batteries.
    alice.stored_energy[BATTERIES] = 1.5 * BATTERY_CAPACITY
    _advance(session)
    # Set once Round 2 has started, which sets every player's cash for it (#1016).
    alice.money = 10_000_000.0
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

    _advance(session)

    assert session.network.members[1].stored_energy == {}


def test_stored_energy_survives_a_restart(path: Path, clock: _Clock) -> None:
    _batteries_retiring(path, clock)

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)

    assert reopened.network.members[1].stored_energy == {BATTERIES: 1.5 * BATTERY_CAPACITY}


def test_a_failed_save_keeps_the_energy_that_would_be_lost(
    path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    session = _batteries_retiring(path, clock)
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

    with pytest.raises(OSError):
        _advance(session)

    assert session.network.members[1].stored_energy == {BATTERIES: 1.5 * BATTERY_CAPACITY}


# --- price setting (#1002) ------------------------------------------------------------------

GAS = FacilityId.GAS_BURNER


def _trading(path: Path, clock: _Clock) -> WorkshopSession:
    """A session in Round 1's spring Trading period, its price-setting window open. Alice (account 1) owns
    six gas burners, enough to keep the grid up, and batteries.
    """
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    alice = session.join(_account(1, "alice"))
    alice.owned_facilities.extend(
        [OwnedFacility(facility=GAS, built_round=1)] * 6 + [OwnedFacility(facility=BATTERIES, built_round=1)]
    )
    _advance(session)
    _advance(session)
    return session


def test_a_player_starts_with_the_default_prices(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)

    assert session.join(_account(1, "alice")).prices == DEFAULT_PRICES


def test_a_player_changes_prices_while_the_price_setting_window_is_open(path: Path, clock: _Clock) -> None:
    session = _trading(path, clock)

    session.set_price(1, GAS, "sell", 80.0)
    session.set_price(1, GAS, "sell", 90.0)
    session.set_price(1, BATTERIES, "buy", 30.0)

    prices = session.network.members[1].prices
    assert (prices.sell[GAS], prices.buy[BATTERIES]) == (90.0, 30.0)


def test_a_price_can_go_down_to_the_floor_but_not_below(path: Path, clock: _Clock) -> None:
    session = _trading(path, clock)

    session.set_price(1, GAS, "sell", PRICE_FLOOR)
    with pytest.raises(PriceBelowFloorError):
        session.set_price(1, GAS, "sell", PRICE_FLOOR - 0.01)

    assert session.network.members[1].prices.sell[GAS] == PRICE_FLOOR


@pytest.mark.parametrize(("facility", "side"), [(GAS, "sell"), (BATTERIES, "buy")], ids=["sell", "storage buy"])
def test_a_price_can_go_up_to_the_ceiling_but_not_above(
    path: Path, clock: _Clock, facility: FacilityId, side: PriceSide
) -> None:
    session = _trading(path, clock)

    session.set_price(1, facility, side, PRICE_CEILING)
    with pytest.raises(PriceAboveCeilingError):
        session.set_price(1, facility, side, PRICE_CEILING + 0.01)

    prices = session.network.members[1].prices
    assert (prices.sell if side == "sell" else prices.buy)[facility] == PRICE_CEILING


def test_a_facility_that_is_not_storage_has_no_buy_price(path: Path, clock: _Clock) -> None:
    session = _trading(path, clock)

    with pytest.raises(NotStorageError):
        session.set_price(1, GAS, "buy", 10.0)


@pytest.mark.parametrize("price", [float("nan"), float("inf")])
def test_a_price_must_be_a_finite_number(path: Path, clock: _Clock, price: float) -> None:
    session = _trading(path, clock)

    with pytest.raises(PriceBelowFloorError):
        session.set_price(1, GAS, "sell", price)


def test_prices_are_locked_once_the_window_runs_out(path: Path, clock: _Clock) -> None:
    session = _trading(path, clock)
    clock.tick(minutes=5)

    with pytest.raises(PriceSettingClosedError):
        session.set_price(1, GAS, "sell", 80.0)

    assert session.network.members[1].prices == DEFAULT_PRICES


def test_prices_cannot_be_set_outside_a_trading_period(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    session.join(_account(1, "alice"))

    with pytest.raises(PriceSettingClosedError):
        session.set_price(1, GAS, "sell", 80.0)
    _advance(session)
    with pytest.raises(PriceSettingClosedError):
        session.set_price(1, GAS, "sell", 80.0)


def test_the_prices_of_a_completed_period_are_kept_for_the_types_the_player_had_operating(
    path: Path, clock: _Clock
) -> None:
    session = _trading(path, clock)
    session.set_price(1, GAS, "sell", 80.0)

    _advance(session)

    assert session.network.members[1].locked_prices == [
        LockedPrices(
            round=1,
            season="spring",
            prices=PriceSheet(sell={GAS: 80.0, BATTERIES: 150.0}, buy={BATTERIES: 60.0}),
        )
    ]


def test_the_next_window_starts_from_the_last_periods_prices(path: Path, clock: _Clock) -> None:
    session = _trading(path, clock)
    session.set_price(1, GAS, "sell", 80.0)
    _advance(session)

    session.set_price(1, BATTERIES, "sell", 700.0)
    _advance(session)

    [spring, summer] = session.network.members[1].locked_prices
    assert (spring.season, spring.prices.sell) == ("spring", {GAS: 80.0, BATTERIES: 150.0})
    assert (summer.season, summer.prices.sell) == ("summer", {GAS: 80.0, BATTERIES: 700.0})


def test_a_player_with_nothing_operating_keeps_no_prices_for_the_period(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    session.join(_account(1, "alice")).owned_facilities.append(
        OwnedFacility(facility=FacilityId.NUCLEAR_REACTOR, built_round=1)
    )
    for _ in range(3):
        _advance(session)

    assert session.network.members[1].locked_prices == []


def test_prices_survive_a_restart(path: Path, clock: _Clock) -> None:
    session = _trading(path, clock)
    session.set_price(1, GAS, "sell", 80.0)
    _advance(session)
    session.set_price(1, GAS, "sell", 70.0)

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)

    alice = reopened.network.members[1]
    assert alice.prices.sell[GAS] == 70.0
    assert [locked.prices.sell[GAS] for locked in alice.locked_prices] == [80.0]


def test_a_failed_save_undoes_the_price_change(path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch) -> None:
    session = _trading(path, clock)
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.set_price(1, GAS, "sell", 80.0)

    assert session.network.members[1].prices == DEFAULT_PRICES


def test_an_advance_that_fails_to_save_keeps_no_prices(
    path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    session = _trading(path, clock)
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

    with pytest.raises(OSError):
        _advance(session)

    assert session.checkpoint == TradingPeriod(round=1, season="spring")
    assert session.network.members[1].locked_prices == []


# --- the room's prices (#1299) ----------------------------------------------------------------


def _quote(price: float, previous: float | None = None, *, default: float) -> QuotedPrice:
    return QuotedPrice(price=price, previous=previous, default=default)


def test_the_room_sees_every_players_live_prices_for_the_types_they_have_operating(path: Path, clock: _Clock) -> None:
    session = _trading(path, clock)
    session.join(_account(2, "bob"))
    session.set_price(1, GAS, "sell", 80.0)

    room = session.market_prices(TradingPeriod(round=1, season="spring"))

    assert room.live
    assert room.players == [
        PlayerQuotes(
            account_id=1,
            username="alice",
            sell={GAS: _quote(80.0, default=90.0), BATTERIES: _quote(150.0, default=150.0)},
            buy={BATTERIES: _quote(60.0, default=60.0)},
        ),
        PlayerQuotes(account_id=2, username="bob", sell={}, buy={}),
    ]


def test_the_room_lists_every_type_someone_has_a_price_for_in_catalog_order(path: Path, clock: _Clock) -> None:
    session = _trading(path, clock)
    session.join(_account(2, "bob"))
    _advance(session)

    room = session.market_prices(TradingPeriod(round=1, season="spring"))

    # Whatever the reader owns or can buy now: a settled period lists the types it ran.
    assert room.facilities == [
        MarketFacility(id=facility, name=CATALOG[facility].name) for facility in CATALOG if facility in (GAS, BATTERIES)
    ]


def test_each_price_is_compared_with_the_one_the_last_period_ran_at(path: Path, clock: _Clock) -> None:
    session = _trading(path, clock)
    session.set_price(1, GAS, "sell", 90.0)
    _advance(session)

    session.set_price(1, GAS, "sell", 200.0)
    session.set_price(1, GAS, "sell", 150.0)
    [alice] = session.market_prices(TradingPeriod(round=1, season="summer")).players

    assert alice.sell == {
        GAS: _quote(150.0, previous=90.0, default=90.0),
        BATTERIES: _quote(150.0, previous=150.0, default=150.0),
    }
    assert alice.buy == {BATTERIES: _quote(60.0, previous=60.0, default=60.0)}


def test_a_settled_period_shows_the_prices_it_ran_at(path: Path, clock: _Clock) -> None:
    session = _trading(path, clock)
    session.set_price(1, GAS, "sell", 90.0)
    _advance(session)
    session.set_price(1, GAS, "sell", 120.0)
    _advance(session)
    session.set_price(1, GAS, "sell", 50.0)

    room = session.market_prices(TradingPeriod(round=1, season="summer"))

    assert not room.live
    [alice] = room.players
    assert alice.sell[GAS] == _quote(120.0, previous=90.0, default=90.0)


def test_prices_stop_being_live_when_the_window_closes(path: Path, clock: _Clock) -> None:
    session = _trading(path, clock)
    session.advance()

    room = session.market_prices(TradingPeriod(round=1, season="spring"))

    assert not room.live
    assert room.players[0].sell[GAS] == _quote(DEFAULT_PRICES.sell[GAS], default=DEFAULT_PRICES.sell[GAS])


def test_a_period_that_has_not_started_has_no_prices(path: Path, clock: _Clock) -> None:
    session = _trading(path, clock)

    with pytest.raises(NoMarketPricesError):
        session.market_prices(TradingPeriod(round=1, season="summer"))
    with pytest.raises(NoMarketPricesError):
        session.market_prices(TradingPeriod(round=2, season="spring"))


# --- the Trading-period engine (#1003) ------------------------------------------------------

FLEET = [
    OwnedFacility(facility=FacilityId.COMBINED_CYCLE, built_round=1),
    OwnedFacility(facility=FacilityId.COMBINED_CYCLE, built_round=1),
    OwnedFacility(facility=FacilityId.COMBINED_CYCLE, built_round=1),
    OwnedFacility(facility=FacilityId.ONSHORE_WIND_TURBINE, built_round=1),
    OwnedFacility(facility=BATTERIES, built_round=1),
]


def _pricing(path: Path, clock: _Clock) -> WorkshopSession:
    """A session in Round 1's spring Trading period, its price-setting window open. Alice (account 1) owns
    ``FLEET`` and starts with a quarter of her batteries charged.
    """
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    alice = session.join(_account(1, "alice"))
    alice.owned_facilities.extend(FLEET)
    alice.stored_energy = {BATTERIES: BATTERY_CAPACITY / 4}
    _advance(session)
    _advance(session)
    return session


def _expected_outcome(session: WorkshopSession, alice: WorkshopPlayer) -> TradingOutcome:
    """What the engine makes of Alice's spring, run directly on the session's inputs."""
    assert session.demand_amplitude is not None
    return simulate_trading_period(
        [Bidder(1, FLEET, alice.prices, {BATTERIES: BATTERY_CAPACITY / 4})],
        round_number=1,
        season="spring",
        round_format=session.current_format(),
        amplitude=session.demand_amplitude,
        curve=national_demand_curve(),
        weather=representative_weather(session.weather_seed),
    )


def test_a_trading_period_settles_once_its_price_setting_window_runs_out(path: Path, clock: _Clock) -> None:
    session = _pricing(path, clock)
    session.set_price(1, FacilityId.COMBINED_CYCLE, "sell", 90.0)
    clock.tick(minutes=5)

    assert _settle(session)

    alice = session.network.members[1]
    expected = _expected_outcome(session, alice)
    [result] = alice.trading_results
    # Fuel procurement is automatic, so settling adds the fuel the plants burned (#1009).
    assert result == expected.results[1].model_copy(update={"fuel": result.fuel})
    assert result.fuel_cost > 0
    assert (result.round, result.season) == (1, "spring")
    assert result.facilities[FacilityId.COMBINED_CYCLE].revenue > 0
    assert alice.money == pytest.approx(WORKSHOP_STARTING_BUDGET + result.operating_profit)
    assert alice.stored_energy == expected.stored_energy[1]
    assert [locked.prices.sell[FacilityId.COMBINED_CYCLE] for locked in alice.locked_prices] == [90.0]


def test_the_demand_scales_with_the_players_in_the_first_trading_period(path: Path, clock: _Clock) -> None:
    session = _pricing(path, clock)
    session.join(_account(2, "bob"))
    clock.tick(minutes=5)
    _settle(session)

    assert session.demand_amplitude == pytest.approx(round_one_amplitude(PER_PLAYER_BASE_AMPLITUDE, headcount=2))

    session.join(_account(3, "carol"))
    _advance(session)
    clock.tick(minutes=5)
    _settle(session)

    assert session.demand_amplitude == pytest.approx(round_one_amplitude(PER_PLAYER_BASE_AMPLITUDE, headcount=2))


def test_nothing_settles_while_the_price_setting_window_is_open(path: Path, clock: _Clock) -> None:
    session = _pricing(path, clock)

    assert not _settle(session)

    alice = session.network.members[1]
    assert (alice.trading_results, alice.locked_prices) == ([], [])


def test_a_trading_period_settles_only_once(path: Path, clock: _Clock) -> None:
    session = _pricing(path, clock)
    clock.tick(minutes=5)
    _settle(session)
    money = session.network.members[1].money

    assert not _settle(session)
    _advance(session)

    alice = session.network.members[1]
    assert alice.money == money
    assert len(alice.trading_results) == len(alice.locked_prices) == 1


def test_advancing_before_the_window_runs_out_closes_it_and_waits_for_the_settlement(path: Path, clock: _Clock) -> None:
    session = _pricing(path, clock)

    assert session.advance() == TradingPeriod(round=1, season="spring")

    assert not session.price_setting_open()
    assert _settle(session)
    assert session.advance() == TradingPeriod(round=1, season="summer")
    alice = session.network.members[1]
    assert [(result.round, result.season) for result in alice.trading_results] == [(1, "spring")]


def test_the_session_cannot_advance_while_the_period_is_being_simulated(path: Path, clock: _Clock) -> None:
    session = _pricing(path, clock)
    clock.tick(minutes=5)
    job = session.start_settlement()
    assert job is not None

    with pytest.raises(SettlementRunningError):
        session.advance()

    session.finish_settlement(job, session.run_settlement(job))
    assert session.advance() == TradingPeriod(round=1, season="summer")


def test_a_period_being_simulated_is_not_started_twice(path: Path, clock: _Clock) -> None:
    session = _pricing(path, clock)
    clock.tick(minutes=5)

    assert session.start_settlement() is not None
    assert session.start_settlement() is None


def test_the_simulation_reports_its_progress(path: Path, clock: _Clock) -> None:
    session = _pricing(path, clock)
    clock.tick(minutes=5)
    assert session.settlement is None
    job = session.start_settlement()
    assert job is not None

    assert session.settlement == SettlementProgress(TradingPeriod(round=1, season="spring"), 0, 14)
    outcome = session.run_settlement(job)
    assert session.settlement == SettlementProgress(TradingPeriod(round=1, season="spring"), 14, 14)
    session.finish_settlement(job, outcome)
    assert session.settlement is None


def test_an_abandoned_simulation_starts_again(path: Path, clock: _Clock) -> None:
    session = _pricing(path, clock)
    clock.tick(minutes=5)
    job = session.start_settlement()
    assert job is not None

    session.abandon_settlement(job)

    assert session.settlement is None
    assert session.start_settlement() is not None


def test_a_player_who_joins_during_the_simulation_gets_nothing_from_it(path: Path, clock: _Clock) -> None:
    session = _pricing(path, clock)
    clock.tick(minutes=5)
    job = session.start_settlement()
    assert job is not None

    bob = session.join(_account(2, "bob"))
    session.finish_settlement(job, session.run_settlement(job))

    assert (bob.money, bob.trading_results) == (WORKSHOP_STARTING_BUDGET, [])
    assert len(session.network.members[1].trading_results) == 1


def test_every_trading_period_of_a_round_settles(path: Path, clock: _Clock) -> None:
    session = _pricing(path, clock)
    for _ in SEASONS:
        _advance(session)

    assert session.checkpoint == Recap(round=1)
    seasons = [result.season for result in session.network.members[1].trading_results]
    assert seasons == list(SEASONS)


def test_a_settlement_survives_a_restart(path: Path, clock: _Clock) -> None:
    session = _pricing(path, clock)
    clock.tick(minutes=5)
    _settle(session)

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)

    before, after = session.network.members[1], reopened.network.members[1]
    assert after.trading_results == before.trading_results
    assert (after.money, after.stored_energy) == (before.money, before.stored_energy)
    assert (reopened.weather_seed, reopened.demand_amplitude) == (session.weather_seed, session.demand_amplitude)
    assert not _settle(reopened)


def test_a_session_keeps_its_weather_seed(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)

    assert WorkshopSession.open(WORKSHOP_CONFIG, path).weather_seed == session.weather_seed


def test_a_failed_save_settles_nothing(path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch) -> None:
    session = _pricing(path, clock)
    clock.tick(minutes=5)
    alice = session.network.members[1]
    before = (alice.money, dict(alice.stored_energy))
    job = session.start_settlement()
    assert job is not None
    outcome = session.run_settlement(job)
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.finish_settlement(job, outcome)
    monkeypatch.undo()

    assert (alice.money, alice.stored_energy) == before
    assert (alice.trading_results, alice.locked_prices) == ([], [])
    assert session.demand_amplitude is None
    # The period still counts as being simulated, so the same result is settled again rather than a new run.
    assert session.start_settlement() is None
    session.finish_settlement(job, outcome)
    assert len(alice.trading_results) == 1
    assert session.settlement is None


def test_a_settled_period_keeps_its_record_across_a_restart(path: Path, clock: _Clock) -> None:
    session = _pricing(path, clock)
    spring = TradingPeriod(round=1, season="spring")
    assert session.period_record(spring) is None
    clock.tick(minutes=5)

    assert _settle(session)

    record = session.period_record(spring)
    assert record is not None
    assert (record.round, record.season, record.point_count) == (1, "spring", 7 * 24)
    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    reloaded = reopened.period_record(spring)
    assert reloaded is not None
    assert reloaded.pools == record.pools
    assert reopened.period_record(TradingPeriod(round=1, season="summer")) is None


def test_a_period_is_listed_only_once_its_record_is_written(
    path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    # A page reading records does not wait for the session's lock, so it must never find a period listed
    # before its record exists.
    session = _pricing(path, clock)
    spring = TradingPeriod(round=1, season="spring")
    clock.tick(minutes=5)
    listed_while_writing: list[bool] = []
    real_save = TradingPeriodRecord.save

    def save(record: TradingPeriodRecord, record_path: Path) -> None:
        listed_while_writing.append(spring in session.recorded_periods)
        real_save(record, record_path)

    monkeypatch.setattr(TradingPeriodRecord, "save", save)

    assert _settle(session)

    assert listed_while_writing == [False]
    assert spring in session.recorded_periods


def test_a_record_read_once_is_kept_in_memory(path: Path, clock: _Clock) -> None:
    session = _pricing(path, clock)
    spring = TradingPeriod(round=1, season="spring")
    clock.tick(minutes=5)
    assert _settle(session)

    first = session.period_record(spring)
    session.record_path(spring).unlink()

    assert session.period_record(spring) is first


def test_a_record_the_session_does_not_list_is_never_read(
    path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The record is written, then the session's own save fails, so the period is not settled.
    session = _pricing(path, clock)
    spring = TradingPeriod(round=1, season="spring")
    clock.tick(minutes=5)
    job = session.start_settlement()
    assert job is not None
    outcome = session.run_settlement(job)
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.finish_settlement(job, outcome)

    assert session.record_path(spring).exists()
    assert session.period_record(spring) is None


def test_a_cancelled_simulation_stops_and_changes_nothing(path: Path, clock: _Clock) -> None:
    session = _pricing(path, clock)
    clock.tick(minutes=5)
    job = session.start_settlement()
    assert job is not None

    job.cancelled.set()

    with pytest.raises(SettlementCancelledError):
        session.run_settlement(job)
    assert session.network.members[1].trading_results == []


def test_a_trading_period_settles_to_the_scaled_week_worked_out_by_hand(path: Path, clock: _Clock) -> None:
    # Four combined cycles (320 MW) asking 100 meet every tier of demand willing to pay at least 100: 160% of
    # nominal demand, which stays under 190 MW for one player in spring. Above them the next tier pays only 80, so
    # every hourly clearing sells 1.6 x nominal demand at 100.
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    plants = [OwnedFacility(facility=FacilityId.COMBINED_CYCLE, built_round=1)] * 4
    session.join(_account(1, "alice")).owned_facilities.extend(plants)
    _advance(session)
    _advance(session)
    session.set_price(1, FacilityId.COMBINED_CYCLE, "sell", 100.0)
    clock.tick(minutes=5)

    _settle(session)

    # The week's demand is scaled to the season's average.
    curve = national_demand_curve()
    amplitude = round_one_amplitude(PER_PLAYER_BASE_AMPLITUDE, headcount=1) * demand_scale(
        "spring", RoundFormat(), curve
    )
    hourly = [
        1.6 * nominal_demand(amplitude, curve, SettlementPeriod(day, hour, 24))
        for day in representative_week("spring")
        for hour in range(24)
    ]
    alice = session.network.members[1]
    [result] = alice.trading_results
    plant = result.facilities[FacilityId.COMBINED_CYCLE]
    assert plant.sold == pytest.approx(sum(hourly) * 13)
    assert plant.revenue == pytest.approx(sum(hourly) / 1e6 * 100 * 13)
    om = 4 * om_owed(plants[0], current_round=1, production=[output / 4 for output in hourly])
    assert plant.om == pytest.approx(om)
    # Fuel procurement is automatic, so the plants' fuel is paid for too (#1009).
    assert alice.money == pytest.approx(WORKSHOP_STARTING_BUDGET + plant.revenue - om - result.fuel_cost)


def test_a_failed_simulation_settles_nothing(path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch) -> None:
    session = _pricing(path, clock)
    clock.tick(minutes=5)

    def unreadable_curve() -> None:
        raise OSError("the demand curve cannot be read")

    monkeypatch.setattr(session_module, "national_demand_curve", unreadable_curve)
    with pytest.raises(OSError):
        _settle(session)
    monkeypatch.undo()

    alice = session.network.members[1]
    assert (alice.trading_results, alice.locked_prices) == ([], [])
    assert session.demand_amplitude is None
    assert _settle(session)
    assert len(alice.locked_prices) == 1


# --- round format: full-season mode, clearings per day and storage (#1004) ------------------

HYDROGEN = FacilityId.HYDROGEN_STORAGE
FULL_SEASON = {"trading_format": "full_season", "storage": "all"}


def _set_format(session: WorkshopSession, round_number: int, **round_format: object) -> None:
    """Set Round ``round_number``'s format to ``round_format``, keeping its other levers. The change carries to every
    later Round.
    """
    session.set_levers(round_number, LeverChanges(**RoundFormat.model_validate(round_format).model_dump()))


def test_a_session_starts_with_representative_weeks_hourly_clearings_and_batteries_only(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)

    assert session.current_format() == RoundFormat()


def test_the_facilitator_changes_the_levers_and_they_survive_a_restart(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    levers = RoundLevers(round_format=RoundFormat(trading_format="full_season", clearings_per_day=96))

    session.set_levers(1, LeverChanges(trading_format="full_season", clearings_per_day=96))

    assert session.plans[0].levers == levers
    assert WorkshopSession.open(WORKSHOP_CONFIG, path).plans[0].levers == levers


def test_a_failed_save_undoes_the_lever_change(path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

    with pytest.raises(OSError):
        _set_format(session, 1, clearings_per_day=288)

    assert [plan.levers for plan in session.plans] == [RoundLevers()] * session.round_count


def test_before_round_one_the_format_follows_its_plan(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)

    _set_format(session, 1, **FULL_SEASON)

    assert session.current_format().trading_format == "full_season"


def test_each_round_runs_with_the_format_of_its_plan(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    _advance(session)

    _set_format(session, 2, clearings_per_day=288, **FULL_SEASON)

    assert session.current_format() == RoundFormat()
    while session.checkpoint != Investment(round=2):
        _advance(session)
    assert session.current_format() == RoundFormat(trading_format="full_season", clearings_per_day=288, storage="all")


def test_a_rounds_format_survives_a_restart(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    _set_format(session, 1, **FULL_SEASON)
    _advance(session)
    _set_format(session, 2, trading_format="full_season", storage="off")

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path)

    assert reopened.current_format() == RoundFormat(trading_format="full_season", storage="all")
    assert reopened.plans[1].levers.round_format.storage == "off"


def test_hydrogen_storage_can_be_bought_only_in_a_round_allowing_every_storage_type(path: Path, clock: _Clock) -> None:
    session = _investing(path, clock)
    with pytest.raises(FacilityNotOfferedError):
        session.select(1, HYDROGEN)

    _set_format(session, 2, **FULL_SEASON)
    while session.checkpoint != Investment(round=2):
        _advance(session)
    session.select(1, HYDROGEN)

    assert session.network.members[1].selection == [HYDROGEN]


def test_without_storage_no_battery_can_be_bought(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    session.join(_account(1, "alice"))
    _set_format(session, 1, storage="off")
    _advance(session)

    with pytest.raises(FacilityNotOfferedError):
        session.select(1, BATTERIES)


def test_storage_built_in_a_full_season_keeps_running_after_switching_back(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    session.join(_account(1, "alice")).owned_facilities.append(OwnedFacility(facility=HYDROGEN, built_round=1))
    _set_format(session, 1, **FULL_SEASON)
    _set_format(session, 3)
    while session.checkpoint != TradingPeriod(round=3, season="spring"):
        _advance(session)

    assert HYDROGEN not in {facility.id for facility in session.offered_facilities()}
    clock.tick(minutes=5)
    _settle(session)
    [*_, result] = session.network.members[1].trading_results
    assert (result.round, list(result.facilities)) == (3, [HYDROGEN])


def test_a_full_season_trading_period_simulates_every_day_of_its_season(path: Path, clock: _Clock) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    # Two combined cycles meet the must-serve demand of one player, so the grid never goes down.
    plants = [OwnedFacility(facility=FacilityId.COMBINED_CYCLE, built_round=1)] * 2
    session.join(_account(1, "alice")).owned_facilities.extend(plants)
    _set_format(session, 1, trading_format="full_season")
    _advance(session)
    _advance(session)
    clock.tick(minutes=5)
    job = session.start_settlement()
    assert job is not None
    reported: list[int] = []
    real_simulate = session_module.simulate_trading_period

    def recording(*args: object, on_day_done: Callable[[int], None], **kwargs: object) -> TradingOutcome:
        def report(days_done: int) -> None:
            on_day_done(days_done)
            assert session.settlement is not None
            reported.append(session.settlement.days_done)

        return real_simulate(*args, on_day_done=report, **kwargs)  # type: ignore[arg-type]

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(session_module, "simulate_trading_period", recording)
        session.finish_settlement(job, session.run_settlement(job))

    assert reported == list(range(1, 92))
    [result] = session.network.members[1].trading_results
    assert result.facilities[FacilityId.COMBINED_CYCLE].generation > 0


# --- blackout -----------------------------------------------------------------------------------


def _blacked_out(path: Path, clock: _Clock) -> WorkshopSession:
    """A session in Round 1's settled spring Trading period, in which the grid went down: Alice (account 1)
    owns nothing, so nothing meets the must-serve demand her presence brings. It goes down at the first clearing, and
    again each time it restarts, a day later.
    """
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    session.join(_account(1, "alice"))
    _advance(session)
    _advance(session)
    clock.tick(minutes=5)
    _settle(session)
    return session


def test_each_blackout_is_recorded_with_the_day_and_minute_it_happened(path: Path, clock: _Clock) -> None:
    session = _blacked_out(path, clock)

    assert session.blackouts == [
        Blackout(round=1, season="spring", day=day, minute=0) for day in representative_week("spring")
    ]


def test_the_round_goes_on_after_a_blackout(path: Path, clock: _Clock) -> None:
    session = _blacked_out(path, clock)

    assert session.upcoming_checkpoint() == TradingPeriod(round=1, season="summer")
    visited = [_advance(session) for _ in range(5)]

    assert visited == [
        *(TradingPeriod(round=1, season=season) for season in SEASONS[1:]),
        Recap(round=1),
        Investment(round=2),
    ]


def test_the_next_trading_period_starts_from_the_rationing_of_the_blackouts_before_it(
    path: Path, clock: _Clock
) -> None:
    session = _blacked_out(path, clock)
    _advance(session)
    clock.tick(minutes=5)

    job = session.start_settlement()

    assert job is not None
    assert job.rationing == pytest.approx(RATIONING ** len(session.blackouts))


def test_rationing_ends_with_the_round(path: Path, clock: _Clock) -> None:
    session = _blacked_out(path, clock)
    while session.checkpoint != TradingPeriod(round=2, season="spring"):
        _advance(session)
    clock.tick(minutes=5)

    job = session.start_settlement()

    assert job is not None
    assert job.rationing == 1.0


def test_a_blackout_survives_a_restart(path: Path, clock: _Clock) -> None:
    session = _blacked_out(path, clock)

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)

    assert reopened.blackouts == session.blackouts


def test_a_failed_save_records_no_blackout(path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=clock)
    session.join(_account(1, "alice"))
    _advance(session)
    _advance(session)
    clock.tick(minutes=5)
    job = session.start_settlement()
    assert job is not None
    outcome = session.run_settlement(job)
    assert outcome.blackouts
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.finish_settlement(job, outcome)

    assert session.blackouts == []


# --- the budget floor (#1016) and the blackout cost (#1286) ---------------------------------------

FLOOR = WORKSHOP_CASH_FLOOR


def _at_round_one_recap(path: Path) -> WorkshopSession:
    """A session at Round 1's Recap, with Alice (account 1) and Bob (account 2), and no blackout: both own
    ``FLEET``, which keeps the grid up.
    """
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    for account_id, username in [(1, "alice"), (2, "bob")]:
        session.join(_account(account_id, username)).owned_facilities.extend(FLEET)
    while session.checkpoint != Recap(round=1):
        _advance(session)
    assert session.blackouts == []
    return session


def test_a_player_below_the_floor_is_topped_up_to_exactly_it_as_the_round_starts(path: Path) -> None:
    session = _at_round_one_recap(path)
    session.network.members[1].money = 6_000_000.0

    _advance(session)

    assert session.checkpoint == Investment(round=2)
    assert session.network.members[1].money == FLOOR


def test_a_player_in_debt_is_topped_up_to_the_floor(path: Path) -> None:
    session = _at_round_one_recap(path)
    session.network.members[1].money = -15_000_000.0

    _advance(session)

    assert session.network.members[1].money == FLOOR


def test_the_floor_top_up_leaves_the_final_score_unchanged(path: Path) -> None:
    session = _at_round_one_recap(path)
    alice = session.network.members[1]
    alice.money = -15_000_000.0
    before = score(alice, completed_rounds=session.round_count, price_round_count=session.price_round_count)

    _advance(session)

    assert alice.money == FLOOR
    assert score(alice, completed_rounds=session.round_count, price_round_count=session.price_round_count) == before


def test_cash_above_the_floor_carries_forward(path: Path) -> None:
    session = _at_round_one_recap(path)
    session.network.members[1].money = FLOOR + 1.0
    session.network.members[2].money = 150_000_000.0

    _advance(session)

    assert session.network.members[1].money == FLOOR + 1.0
    assert session.network.members[2].money == 150_000_000.0


def test_a_top_up_survives_a_restart(path: Path) -> None:
    session = _at_round_one_recap(path)
    session.network.members[1].money = 6_000_000.0
    _advance(session)

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path)

    assert reopened.network.members[1].money == FLOOR


def test_an_advance_that_fails_to_save_tops_up_nobody(path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    session = _at_round_one_recap(path)
    session.network.members[1].money = 6_000_000.0
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

    with pytest.raises(OSError):
        _advance(session)

    assert session.checkpoint == Recap(round=1)
    assert session.network.members[1].money == 6_000_000.0


def test_round_one_starts_with_the_cash_each_player_holds(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    session.join(_account(1, "alice")).money = 6_000_000.0

    _advance(session)

    assert session.checkpoint == Investment(round=1)
    assert session.network.members[1].money == 6_000_000.0


def test_no_top_up_happens_inside_a_round(path: Path) -> None:
    session = _at_round_one_recap(path)
    _advance(session)
    session.network.members[1].money = 6_000_000.0

    _advance(session)

    assert session.checkpoint == TradingPeriod(round=2, season="spring")
    assert session.network.members[1].money < FLOOR


def _blacked_out_twice_in_winter(path: Path) -> WorkshopSession:
    """A session in Round 1's settled winter Trading period, with Alice (account 1) and Bob (account 2) owning
    ``FLEET``, and two blackouts recorded in it.
    """
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    for account_id, username in [(1, "alice"), (2, "bob")]:
        session.join(_account(account_id, username)).owned_facilities.extend(FLEET)
    while session.checkpoint != TradingPeriod(round=1, season="winter"):
        _advance(session)
    session.advance()
    assert _settle(session)
    session.blackouts = [
        Blackout(round=1, season="winter", day=day, minute=18 * 60) for day in representative_week("winter")[:2]
    ]
    return session


def test_each_blackout_costs_every_player_thirty_percent_of_the_rounds_operating_profit_as_the_recap_opens(
    path: Path,
) -> None:
    session = _blacked_out_twice_in_winter(path)
    players = list(session.network.players())
    before = [player.money for player in players]
    profits = [round_operating_profit(player.trading_results, 1) for player in players]
    assert all(profit > 0 for profit in profits)

    assert session.advance() == Recap(round=1)

    assert [player.money for player in players] == pytest.approx(
        [money - 0.6 * profit for money, profit in zip(before, profits, strict=True)]
    )


def test_the_blackout_cost_leaves_every_score_unchanged(path: Path) -> None:
    session = _blacked_out_twice_in_winter(path)
    players = list(session.network.players())
    before = [score(player, completed_rounds=1, price_round_count=session.price_round_count) for player in players]

    session.advance()

    assert [
        score(player, completed_rounds=1, price_round_count=session.price_round_count) for player in players
    ] == before


def test_demand_growth_counts_the_operating_profit_before_the_blackout_cost(path: Path) -> None:
    session = _blacked_out_twice_in_winter(path)
    players = list(session.network.players())
    average = sum(round_operating_profit(player.trading_results, 1) for player in players) / len(players)

    session.advance()

    assert session.demand_growth[2] == pytest.approx(growth_factor(average))


def test_a_recap_that_fails_to_save_charges_no_blackout_cost(path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    session = _blacked_out_twice_in_winter(path)
    players = list(session.network.players())
    before = [player.money for player in players]
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.advance()

    assert [player.money for player in players] == before


def test_a_blackout_no_longer_resets_anyones_cash(path: Path, clock: _Clock) -> None:
    session = _blacked_out(path, clock)
    session.join(_account(2, "bob"))
    while session.checkpoint != Recap(round=1):
        _advance(session)
    session.network.members[1].money = 6_000_000.0
    session.network.members[2].money = 150_000_000.0

    _advance(session)

    assert session.checkpoint == Investment(round=2)
    assert session.network.members[1].money == FLOOR
    assert session.network.members[2].money == 150_000_000.0


# --- the scoreboard all game (#1250) -------------------------------------------------------------


@pytest.mark.parametrize(
    ("checkpoint", "completed"),
    [
        (NotStarted(), 0),
        (Investment(round=1), 0),
        (TradingPeriod(round=1, season="winter"), 0),
        (Recap(round=1), 1),
        (Investment(round=2), 1),
        (Recap(round=3), 3),
        (Finished(), 3),
    ],
)
def test_a_round_is_completed_once_its_recap_opens(checkpoint: Checkpoint, completed: int) -> None:
    assert completed_rounds(checkpoint, round_count=3) == completed


def test_the_scoreboard_counts_the_rounds_completed_so_far(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path)
    for account_id, username in [(1, "alice"), (2, "bob")]:
        session.join(_account(account_id, username)).owned_facilities.extend(FLEET)
    players = session.network.players()

    board = session.scoreboard()
    assert (board.completed_rounds, board.final) == (0, False)
    assert board.scores == ranked(players, completed_rounds=0, price_round_count=session.price_round_count)

    while session.checkpoint != TradingPeriod(round=2, season="summer"):
        _advance(session)
    # Round 2's spring is settled, but the Round is not completed, so it is not counted yet.
    board = session.scoreboard()
    assert (board.completed_rounds, board.final) == (1, False)
    assert board.scores == ranked(players, completed_rounds=1, price_round_count=session.price_round_count)
    assert board.scores != ranked(players, completed_rounds=2, price_round_count=session.price_round_count)

    while not isinstance(session.checkpoint, Finished):
        _advance(session)
    board = session.scoreboard()
    assert (board.completed_rounds, board.final) == (session.round_count, True)
    assert board.scores == ranked(
        players, completed_rounds=session.round_count, price_round_count=session.price_round_count
    )
