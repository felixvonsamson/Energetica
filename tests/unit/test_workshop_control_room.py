"""Unit tests for the control room's figures (#1289): what the projector dashboard shows the room."""

from __future__ import annotations

import math

import numpy as np
import pytest

from energetica.workshop.blackout import Blackout
from energetica.workshop.control_room import (
    HYDRO_GUARANTEED_SHARE,
    STORAGE_HOURS,
    BlackoutRisk,
    blackout_risk,
    room_capacity,
    BlackoutAlarm,
    EventAlarm,
    PowerSource,
    PriceBox,
    RationingAlarm,
    RoundEmissions,
    UnlockAlarm,
    VoteAlarm,
    alarms,
    power_source,
    price_box,
    price_summary,
    room_generation,
    room_prices,
    round_emissions,
)
from energetica.workshop.events import EVENTS, FiredEvent, Severity, effect_line
from energetica.workshop.facilities import CATALOG, FacilityId
from energetica.workshop.fleet import Purchase
from energetica.workshop.recap import average_price
from energetica.workshop.prices import MarketPrices, PlayerQuotes, QuotedPrice
from energetica.workshop.round_plan import PlannedEvent
from energetica.workshop.seasons import SEASONS, Season
from energetica.workshop.trading import RATIONING, FacilityPerformance, TradingResult
from energetica.workshop.unlocks import Unlock
from energetica.workshop.weather import RunWeather, _hours
from energetica.workshop.votes import CARBON_TAX_RATE, VoteOutcome


def _fired(event: str, severity: Severity = "base", *, round_number: int, season: Season | None = None) -> FiredEvent:
    return FiredEvent.of(PlannedEvent(event=event, severity=severity), round_number=round_number, season=season)


def _performance(
    *, generation: float = 0.0, sold: float = 0.0, revenue: float = 0.0, emissions: float = 0.0
) -> FacilityPerformance:
    return FacilityPerformance(
        generation=generation,
        sold=sold,
        dumped=generation - sold,
        bought=0.0,
        revenue=revenue,
        dump_cost=0.0,
        purchase_cost=0.0,
        om=0.0,
        emissions=emissions,
        capacity_factor=0.5,
    )


def _result(
    facilities: dict[FacilityId, FacilityPerformance], *, round_number: int = 1, season: Season = "spring"
) -> TradingResult:
    return TradingResult(round=round_number, season=season, facilities=facilities)


# --- power sources ------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("facility", "source"),
    [
        (FacilityId.COAL_BURNER, PowerSource.COAL),
        (FacilityId.MODERN_COAL_PLANT, PowerSource.COAL),
        (FacilityId.GAS_BURNER, PowerSource.GAS),
        (FacilityId.COMBINED_CYCLE, PowerSource.GAS),
        (FacilityId.NUCLEAR_REACTOR_GEN4, PowerSource.NUCLEAR),
        (FacilityId.LARGE_WATER_DAM, PowerSource.HYDRO),
        (FacilityId.OFFSHORE_WIND_TURBINE, PowerSource.WIND),
        (FacilityId.MULTI_LAYER_PV, PowerSource.SOLAR),
        (FacilityId.CSP_SOLAR, PowerSource.SOLAR),
        (FacilityId.LITHIUM_ION_BATTERIES, PowerSource.STORAGE),
        (FacilityId.HYDROGEN_STORAGE, PowerSource.STORAGE),
        (FacilityId.PUMPED_HYDRO, PowerSource.STORAGE),
    ],
)
def test_each_facility_counts_towards_one_power_source(facility: FacilityId, source: PowerSource) -> None:
    assert power_source(facility) == source


def test_every_facility_in_the_catalog_has_a_power_source() -> None:
    for facility in CATALOG:
        power_source(facility)


# --- room prices --------------------------------------------------------------------------------


def test_a_price_box_holds_the_lowest_the_quartiles_the_median_and_the_highest_price() -> None:
    assert price_box([40.0, 10.0, 30.0, 20.0, 50.0]) == PriceBox(low=10.0, q1=20.0, median=30.0, q3=40.0, high=50.0)


def test_a_single_price_makes_a_flat_box() -> None:
    assert price_box([25.0]) == PriceBox(low=25.0, q1=25.0, median=25.0, q3=25.0, high=25.0)


def test_no_price_makes_no_box() -> None:
    assert price_box([]) is None


def _quotes(account_id: int, sell: dict[FacilityId, float], buy: dict[FacilityId, float] | None = None) -> PlayerQuotes:
    return PlayerQuotes(
        account_id=account_id,
        username=f"p{account_id}",
        sell={facility: QuotedPrice(price=price, previous=None) for facility, price in sell.items()},
        buy={facility: QuotedPrice(price=price, previous=None) for facility, price in (buy or {}).items()},
    )


def test_room_prices_pool_every_players_prices_by_power_source_without_names() -> None:
    market = MarketPrices(
        round=2,
        season="summer",
        live=True,
        facilities=[],
        players=[
            _quotes(1, {FacilityId.COAL_BURNER: 60.0, FacilityId.MODERN_COAL_PLANT: 50.0}),
            _quotes(
                2,
                {FacilityId.COAL_BURNER: 70.0, FacilityId.LITHIUM_ION_BATTERIES: 150.0},
                {FacilityId.LITHIUM_ION_BATTERIES: 60.0},
            ),
        ],
    )

    prices = room_prices(market)

    assert (prices.round, prices.season, prices.live) == (2, "summer", True)
    assert prices.boxes == {
        "coal": price_box([60.0, 50.0, 70.0]),
        "storage_sell": price_box([150.0]),
        "storage_buy": price_box([60.0]),
    }


# --- what each season did -----------------------------------------------------------------------


def test_the_average_price_is_what_generators_earned_per_mwh_sold() -> None:
    results = [
        _result({FacilityId.COAL_BURNER: _performance(sold=2e6, revenue=100.0)}),
        _result(
            {
                FacilityId.ONSHORE_WIND_TURBINE: _performance(sold=2e6, revenue=60.0),
                # Storage resells energy generated elsewhere, so it is left out, as in the Recap.
                FacilityId.LITHIUM_ION_BATTERIES: _performance(sold=1e6, revenue=500.0),
            }
        ),
    ]

    assert average_price(results) == pytest.approx(40.0)


def test_a_season_that_sold_nothing_has_no_average_price() -> None:
    assert average_price([]) is None


def test_the_rooms_generation_adds_up_every_players_energy_by_power_source() -> None:
    results = [
        _result({FacilityId.COAL_BURNER: _performance(generation=3e6), FacilityId.GAS_BURNER: _performance()}),
        _result(
            {
                FacilityId.MODERN_COAL_PLANT: _performance(generation=1e6),
                FacilityId.LITHIUM_ION_BATTERIES: _performance(generation=5e5),
            }
        ),
    ]

    assert room_generation(results) == {
        PowerSource.COAL: 4e6,
        PowerSource.GAS: 0.0,
        PowerSource.STORAGE: 5e5,
    }


def test_a_price_summary_spans_the_10th_to_the_90th_percentile_of_the_cleared_prices() -> None:
    prices = np.arange(101, dtype=np.float64)

    summary = price_summary(prices)

    assert summary is not None
    assert (summary.low, summary.high) == (pytest.approx(10.0), pytest.approx(90.0))


def test_the_duration_curve_runs_from_the_highest_price_to_the_lowest() -> None:
    prices = np.array([30.0, 10.0, 50.0, 20.0, 40.0])

    summary = price_summary(prices, points=5)

    assert summary is not None
    assert summary.duration_curve == [50.0, 40.0, 30.0, 20.0, 10.0]


def test_the_duration_curve_keeps_only_as_many_points_as_asked_including_both_ends() -> None:
    prices = np.arange(1000, dtype=np.float64)

    summary = price_summary(prices, points=11)

    assert summary is not None
    assert len(summary.duration_curve) == 11
    assert summary.duration_curve[0] == 999.0
    assert summary.duration_curve[-1] == 0.0


def test_points_that_never_settled_are_left_out_of_the_price_summary() -> None:
    # A blackout clears at infinity, and the grid is down, with NaN prices, for the rest of its day.
    prices = np.array([20.0, math.inf, math.nan, math.nan, 40.0])

    summary = price_summary(prices, points=10)

    assert summary is not None
    assert summary.duration_curve == [40.0, 20.0]


def test_a_period_that_never_settled_a_point_has_no_price_summary() -> None:
    assert price_summary(np.array([math.inf, math.nan])) is None


# --- carbon -------------------------------------------------------------------------------------


def test_each_rounds_emissions_count_building_and_running() -> None:
    coal = CATALOG[FacilityId.COAL_BURNER].base_construction_pollution
    purchases = [Purchase(facility=FacilityId.COAL_BURNER, round=1, price=1.0)]
    results = [
        _result({FacilityId.COAL_BURNER: _performance(emissions=500.0)}, round_number=1),
        _result({FacilityId.COAL_BURNER: _performance(emissions=700.0)}, round_number=2, season="autumn"),
    ]

    assert round_emissions(purchases, results, rounds=2, completed=1) == [
        RoundEmissions(round=1, emissions=coal + 500.0, complete=True),
        RoundEmissions(round=2, emissions=700.0, complete=False),
    ]


def test_a_session_that_has_not_started_has_no_rounds_of_emissions() -> None:
    assert round_emissions([], [], rounds=0, completed=0) == []


# --- alarms -------------------------------------------------------------------------------------


def _alarms(**overrides: object) -> list:
    arguments: dict = {
        "fired": [],
        "settled": None,
        "blackouts": [],
        "unlocks": [],
        "vote_outcomes": [],
        "vote_open": None,
    }
    arguments.update(overrides)
    return alarms(**arguments)


def test_a_round_event_raises_an_alarm_as_soon_as_it_fires() -> None:
    fired = _fired("demand.ev_tipping_point", round_number=2)

    assert _alarms(fired=[fired]) == [
        EventAlarm(
            round=2,
            season=None,
            category="demand_shift",
            name=EVENTS["demand.ev_tipping_point"].name,
            effect=effect_line(fired),
        )
    ]


def test_a_seasonal_event_raises_an_alarm_only_once_its_season_is_settled() -> None:
    fired = _fired("climate.heatwave", "major", round_number=2, season="summer")

    assert _alarms(fired=[fired], settled=(2, "spring")) == []
    [alarm] = _alarms(fired=[fired], settled=(2, "summer"))
    assert alarm == EventAlarm(
        round=2, season="summer", category="climate", name="Heatwave", effect="Demand +18% for the summer"
    )


def test_each_blackout_raises_an_alarm_and_another_for_the_rationing_it_leaves() -> None:
    blackouts = [
        Blackout(round=1, season="summer", day=160, minute=1170),
        Blackout(round=1, season="winter", day=320, minute=1080),
    ]

    assert _alarms(blackouts=blackouts, settled=(1, "winter")) == [
        RationingAlarm(round=1, season="winter", rationing=RATIONING**2),
        BlackoutAlarm(round=1, season="winter", day=320, minute=1080),
        RationingAlarm(round=1, season="summer", rationing=RATIONING),
        BlackoutAlarm(round=1, season="summer", day=160, minute=1170),
    ]


def test_rationing_starts_again_from_full_demand_each_round() -> None:
    blackouts = [
        Blackout(round=1, season="summer", day=160, minute=0),
        Blackout(round=2, season="summer", day=160, minute=0),
    ]

    rationing = [alarm.rationing for alarm in _alarms(blackouts=blackouts) if isinstance(alarm, RationingAlarm)]

    assert rationing == [pytest.approx(RATIONING), pytest.approx(RATIONING)]


def test_an_unlock_raises_an_alarm_for_the_round_it_can_be_bought_from() -> None:
    unlock = Unlock(facility=FacilityId.OFFSHORE_WIND_TURBINE, round=3, trigger="investment_threshold")

    assert _alarms(unlocks=[unlock]) == [
        UnlockAlarm(round=3, season=None, facility=FacilityId.OFFSHORE_WIND_TURBINE, name=CATALOG[unlock.facility].name)
    ]


def test_a_vote_raises_an_alarm_while_it_is_open_and_another_with_its_result() -> None:
    assert _alarms(vote_open=3) == [VoteAlarm(round=3, season=None, passed=None, tax_rate=CARBON_TAX_RATE)]
    assert _alarms(vote_outcomes=[VoteOutcome(round=3, passed=True)]) == [
        VoteAlarm(round=3, season="spring", passed=True, tax_rate=CARBON_TAX_RATE)
    ]


def test_alarms_are_listed_newest_first() -> None:
    alarms_raised = _alarms(
        fired=[
            _fired("demand.ev_tipping_point", round_number=2),
            _fired("climate.heatwave", "moderate", round_number=1, season="summer"),
        ],
        settled=(2, "spring"),
        blackouts=[Blackout(round=2, season="spring", day=60, minute=0)],
        unlocks=[Unlock(facility=FacilityId.OFFSHORE_WIND_TURBINE, round=2, trigger="investment_threshold")],
        vote_outcomes=[VoteOutcome(round=2, passed=False)],
    )

    assert [(alarm.kind, alarm.round, alarm.season) for alarm in alarms_raised] == [
        ("rationing", 2, "spring"),
        ("blackout", 2, "spring"),
        # The result is announced as the first Trading period opens.
        ("vote", 2, "spring"),
        ("event", 2, None),
        ("unlock", 2, None),
        ("event", 1, "summer"),
    ]


# --- capacity against demand (#1287) ------------------------------------------------------------

PEAK = 1000e6


def _risk(**overrides: float) -> BlackoutRisk:
    arguments = {
        "peak": PEAK,
        "controllable": 0.0,
        "total": 0.0,
        "weighted": 0.0,
        "storage_power": 0.0,
        "storage_energy": 0.0,
    }
    arguments.update(overrides)
    return blackout_risk(**arguments)


def test_a_blackout_is_guaranteed_when_total_capacity_is_below_the_peak() -> None:
    assert _risk(controllable=500e6, total=999e6, weighted=10e9, storage_power=10e9, storage_energy=1e12) == (
        BlackoutRisk.GUARANTEED
    )


def test_a_blackout_is_likely_when_controllable_capacity_is_short_and_storage_cannot_cover_it() -> None:
    # The gap is 200 MW. sqrt(400 MW x 50 MW) is about 141 MW, short of it.
    assert _risk(controllable=800e6, total=1500e6, weighted=400e6, storage_power=50e6, storage_energy=1e12) == (
        BlackoutRisk.LIKELY
    )


def test_a_blackout_is_unlikely_when_storage_covers_the_controllable_gap() -> None:
    # sqrt(400 MW x 160 MW) is 253 MW, more than the 200 MW gap.
    assert _risk(controllable=800e6, total=1500e6, weighted=400e6, storage_power=160e6, storage_energy=1e12) == (
        BlackoutRisk.UNLIKELY
    )


def test_storage_counts_no_more_power_than_it_can_hold_for_sixteen_hours() -> None:
    # 160 MW of power, but only 16 h x 50 MW of energy: it counts as 50 MW.
    assert _risk(
        controllable=800e6, total=1500e6, weighted=400e6, storage_power=160e6, storage_energy=STORAGE_HOURS * 50e6
    ) == (BlackoutRisk.LIKELY)


def test_a_blackout_is_very_unlikely_when_controllable_capacity_covers_the_peak() -> None:
    assert _risk(controllable=PEAK, total=PEAK) == BlackoutRisk.VERY_UNLIKELY


def test_room_capacity_splits_controllable_weather_dependent_and_storage() -> None:
    power = {facility: CATALOG[facility].base_power_generation for facility in CATALOG}
    capacity_factors = {FacilityId.SMALL_WATER_DAM: 0.55, FacilityId.ONSHORE_WIND_TURBINE: 0.45}

    capacity = room_capacity(
        [
            FacilityId.COAL_BURNER,
            FacilityId.NUCLEAR_REACTOR,
            FacilityId.SMALL_WATER_DAM,
            FacilityId.ONSHORE_WIND_TURBINE,
            FacilityId.LITHIUM_ION_BATTERIES,
        ],
        capacity_factors,
    )

    dam, wind = power[FacilityId.SMALL_WATER_DAM], power[FacilityId.ONSHORE_WIND_TURBINE]
    controllable = power[FacilityId.COAL_BURNER] + power[FacilityId.NUCLEAR_REACTOR] + HYDRO_GUARANTEED_SHARE * dam
    assert capacity.controllable == pytest.approx(controllable)
    assert capacity.total == pytest.approx(controllable + (1 - HYDRO_GUARANTEED_SHARE) * dam + wind)
    assert capacity.weighted == pytest.approx(dam * (0.55 - HYDRO_GUARANTEED_SHARE) + wind * 0.45)
    assert capacity.storage_power == power[FacilityId.LITHIUM_ION_BATTERIES]
    assert capacity.storage_energy == CATALOG[FacilityId.LITHIUM_ION_BATTERIES].base_storage_capacity


def test_hydros_guaranteed_share_is_the_lowest_its_river_table_gives() -> None:
    weather = RunWeather(seed=0)
    hours = [t for season in SEASONS for day in _hours(season) for t in day]

    assert min(weather.share(FacilityId.SMALL_WATER_DAM, t) for t in hours) == pytest.approx(HYDRO_GUARANTEED_SHARE)
