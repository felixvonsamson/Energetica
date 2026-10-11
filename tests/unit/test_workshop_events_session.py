"""Unit tests for events in a Workshop session (#1012): picks waiting for their boundary, and what they do once
they fire.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from energetica.identity.accounts import Account
from energetica.identity.instance_config import InstanceConfig
from energetica.workshop.demand_block import PER_PLAYER_BASE_AMPLITUDE
from energetica.workshop.events import EventPick, FiredEvent, InvalidPickError
from energetica.workshop.facilities import CATALOG, FacilityId, Fuel
from energetica.workshop.session import Investment, NoBoundaryLeftError, Recap, TradingPeriod, WorkshopSession

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
COAL_BURNERS = 3


class _Clock:
    """A clock that never moves: every window stays open until the moderator closes it."""

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
        session.join(account).money = 10_000_000.0
    session.advance()
    for account_id in range(1, PLAYERS + 1):
        for _ in range(COAL_BURNERS):
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
    """Advance as the moderator does, settling each Trading period, until the session is at the next ``kind``."""
    start = session.checkpoint
    while True:
        if isinstance(session.checkpoint, TradingPeriod) and session.settled_period != session.checkpoint:
            _settle(session)
        session.advance()
        if isinstance(session.checkpoint, kind) and session.checkpoint != start:
            return


def _amplitude_for_next_settlement(session: WorkshopSession) -> float:
    """The amplitude the current Trading period is simulated with. Leaves the period being settled."""
    session.advance()
    job = session.start_settlement()
    assert job is not None
    session.abandon_settlement(job)
    return job.demand_amplitude


def test_a_pick_replaces_the_one_waiting_for_the_same_boundary(path: Path) -> None:
    session = _session(path)
    session.pick_event(EventPick(event="climate.heatwave", severity="minor"))
    session.pick_event(EventPick(event="geo.wind_supply_war", severity="base"))
    session.pick_event(EventPick(event="geo.gas_pipeline_disruption", severity="base"))
    session.pick_event(EventPick(event="climate.flood", severity="major"))
    assert [pick.event for pick in session.event_picks] == [
        "geo.wind_supply_war",
        "geo.gas_pipeline_disruption",
        "climate.flood",
    ]


def test_an_invalid_pick_is_refused(path: Path) -> None:
    session = _session(path)
    with pytest.raises(InvalidPickError):
        session.pick_event(EventPick(event="climate.flood", severity="minor"))
    assert session.event_picks == []


def test_an_event_whose_boundary_will_not_come_again_cannot_be_picked(path: Path) -> None:
    session = _session(path, round_count=1)
    with pytest.raises(NoBoundaryLeftError):
        session.pick_event(EventPick(event="demand.recession", severity="base"))
    session.pick_event(EventPick(event="climate.flood", severity="major"))
    _to_next(session, Recap)
    with pytest.raises(NoBoundaryLeftError):
        session.pick_event(EventPick(event="climate.flood", severity="major"))


def test_a_pick_of_an_event_the_catalog_no_longer_has_is_dropped_on_restart(path: Path) -> None:
    session = _session(path)
    session.pick_event(EventPick(event="climate.flood", severity="major"))
    path.write_text(path.read_text().replace('"climate.flood"', '"climate.gone"'))
    reloaded = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=_Clock())
    assert reloaded.event_picks == []
    _to_next(reloaded, TradingPeriod)


def test_a_pick_can_be_dropped_before_it_fires(path: Path) -> None:
    session = _session(path)
    session.pick_event(EventPick(event="climate.heatwave", severity="minor"))
    session.drop_event("climate.heatwave")
    _to_next(session, TradingPeriod)
    assert session.event_picks == []
    assert session.fired_events == []


def test_picks_and_fired_events_survive_a_restart(path: Path) -> None:
    session = _session(path)
    session.pick_event(EventPick(event="climate.flood", severity="major"))
    session.pick_event(EventPick(event="demand.recession", severity="base"))
    _to_next(session, TradingPeriod)
    reloaded = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=_Clock())
    assert reloaded.event_picks == [EventPick(event="demand.recession", severity="base")]
    assert reloaded.fired_events == session.fired_events


def test_a_climate_pick_mid_period_waits_for_the_next_trading_period(path: Path) -> None:
    session = _session(path)
    _to_next(session, TradingPeriod)  # spring
    session.pick_event(EventPick(event="climate.heatwave", severity="major"))
    assert _amplitude_for_next_settlement(session) == pytest.approx(BASE_AMPLITUDE)
    job = session.start_settlement()
    assert job is not None
    session.finish_settlement(job, session.run_settlement(job))
    session.advance()  # summer opens: the heatwave fires
    assert session.fired_events == [
        FiredEvent.of(EventPick(event="climate.heatwave", severity="major"), round_number=1, season="summer")
    ]
    assert session.event_picks == []
    assert _amplitude_for_next_settlement(session) == pytest.approx(BASE_AMPLITUDE * 1.18)
    job = session.start_settlement()
    assert job is not None
    session.finish_settlement(job, session.run_settlement(job))
    session.advance()  # autumn: the heatwave is over
    assert _amplitude_for_next_settlement(session) == pytest.approx(BASE_AMPLITUDE)


def test_a_demand_shift_fires_with_the_next_round_and_lasts(path: Path) -> None:
    session = _session(path)
    session.pick_event(EventPick(event="demand.ev_tipping_point", severity="base"))
    _to_next(session, TradingPeriod)
    assert session.event_picks != []  # Round 1 had already started
    assert _amplitude_for_next_settlement(session) == pytest.approx(BASE_AMPLITUDE)
    _to_next(session, Investment)  # Round 2
    assert session.fired_events[0].round == 2
    assert session.fired_events[0].season is None
    for _ in range(2):
        _to_next(session, TradingPeriod)
        assert _amplitude_for_next_settlement(session) == pytest.approx(BASE_AMPLITUDE * 1.12)


def test_a_disaster_taxes_every_players_revenue_in_its_period(path: Path) -> None:
    session = _session(path)
    session.pick_event(EventPick(event="climate.flood", severity="major"))
    _to_next(session, TradingPeriod)
    _settle(session)
    for player in session.network.players():
        (result,) = player.trading_results
        assert result.revenue_tax_rate == pytest.approx(0.07)
        assert result.revenue_tax == pytest.approx(0.07 * result.revenue)
        assert result.revenue_tax > 0
    session.advance()
    _settle(session)
    for player in session.network.players():
        assert player.trading_results[-1].revenue_tax_rate == 0.0


def test_a_facility_price_shock_moves_the_price_for_its_round_only(path: Path) -> None:
    session = _session(path)
    session.pick_event(EventPick(event="geo.wind_supply_war", severity="base"))
    _to_next(session, Recap)
    session.advance()  # Round 2's Investment phase: the shock fires
    assert session.checkpoint == Investment(round=2)
    wind = CATALOG[FacilityId.ONSHORE_WIND_TURBINE].base_price
    assert session.facility_price(FacilityId.ONSHORE_WIND_TURBINE) == pytest.approx(wind * 1.35)
    assert session.facility_price(FacilityId.COAL_BURNER) == CATALOG[FacilityId.COAL_BURNER].base_price
    player = session.network.members[1]
    money = player.money
    session.select(1, FacilityId.ONSHORE_WIND_TURBINE)
    session.advance()  # close the Investment phase
    session.buy_selections()
    assert player.money == pytest.approx(money - wind * 1.35)
    assert player.purchases[-1].price == pytest.approx(wind * 1.35)
    _to_next(session, Investment)  # Round 3
    assert session.facility_price(FacilityId.ONSHORE_WIND_TURBINE) == wind


def test_a_fuel_shock_lands_with_the_next_trading_period(path: Path) -> None:
    session = _session(path)
    _to_next(session, TradingPeriod)
    spring_gas = session.fuel_prices[Fuel.GAS]
    session.pick_event(EventPick(event="geo.gas_pipeline_disruption", severity="base"))
    session.pick_event(EventPick(event="geo.conflict_resolution", severity="base", fuel=Fuel.COAL))
    assert session.event_picks == [EventPick(event="geo.conflict_resolution", severity="base", fuel=Fuel.COAL)]
    assert session.fuel_prices[Fuel.GAS] == spring_gas
    _to_next(session, TradingPeriod)  # summer
    assert session.fuel_prices[Fuel.COAL].shocked
    assert session.fuel_prices[Fuel.COAL].shock == pytest.approx(0.85)
    assert not session.fuel_prices[Fuel.GAS].shocked


def test_session_emissions_count_building_and_running(path: Path) -> None:
    session = _session(path)
    assert session.emissions() == 0
    session.advance()  # close the Investment phase
    session.buy_selections()
    built = PLAYERS * (
        COAL_BURNERS * CATALOG[FacilityId.COAL_BURNER].base_construction_pollution
        + CATALOG[FacilityId.ONSHORE_WIND_TURBINE].base_construction_pollution
    )
    assert session.emissions() == pytest.approx(built)
    _to_next(session, TradingPeriod)
    _settle(session)
    assert session.emissions() > built
