"""The Trading-period engine (#1003, #1004, #1198).

In representative-week mode, the middle week of the season is cleared through ``sim``'s market and settled by
``sim``'s rules, then scaled ×13 into the Trading period's total. In full-season mode, all 91 days of the season
are cleared and added up. These tests use a flat demand curve and steady weather, so every
clearing of the week is the same and each figure can be worked out by hand.

With a flat curve and an amplitude of 10 MW, the demand block bids 8 MW at any price (must-serve), then
1 MW up to 480, 1.5 MW up to 240, 2 MW up to 120, 2 MW up to 24 and 2 MW up to 5.
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from energetica.workshop.demand_block import DAYS_PER_YEAR, DemandCurve, SettlementPeriod, nominal_demand
from energetica.workshop.facilities import CATALOG, FacilityId, Fuel
from energetica.workshop.fleet import OwnedFacility, om_owed
from energetica.workshop.fuel import FUEL_USE, FuelPurchase
from energetica.workshop.prices import DEFAULT_PRICES, DUMP_COST, PriceSheet
from energetica.workshop.round_format import ClearingsPerDay, RoundFormat, TradingFormat
from energetica.workshop.seasons import SEASON_DAYS, SEASONS, representative_week, season_days
from energetica.workshop.trading import (
    SCARCITY_PRICE,
    Bidder,
    TradingOutcome,
    cleared_day_count,
    demand_scale,
    simulate_trading_period,
)
from energetica.workshop.weather import AverageOutput

from ._weather_helpers import FixedWeather, steady

_FLAT = DemandCurve((1.0,) * DAYS_PER_YEAR)
_AMPLITUDE = 10e6
_HOURS = 24
_WEEKS = SEASON_DAYS // 7

GAS = FacilityId.GAS_BURNER  # 11 MW
COMBINED_CYCLE = FacilityId.COMBINED_CYCLE  # 54 MW
WIND = FacilityId.ONSHORE_WIND_TURBINE  # 11 MW
OFFSHORE_WIND = FacilityId.OFFSHORE_WIND_TURBINE  # 130 MW
BATTERIES = FacilityId.LITHIUM_ION_BATTERIES  # 86 MW, 3.2 GWh, 69% efficient
REACTOR = FacilityId.NUCLEAR_REACTOR  # one Round to build

_BATTERY_CAPACITY = CATALOG[BATTERIES].base_storage_capacity or 0.0
_BATTERY_EFFICIENCY = CATALOG[BATTERIES].base_efficiency or 0.0


def _prices(sell: dict[FacilityId, float], buy: dict[FacilityId, float] | None = None) -> PriceSheet:
    return PriceSheet(sell={**DEFAULT_PRICES.sell, **sell}, buy={**DEFAULT_PRICES.buy, **(buy or {})})


def _bidder(
    *facilities: FacilityId,
    sell: dict[FacilityId, float] | None = None,
    buy: dict[FacilityId, float] | None = None,
    stored_energy: dict[FacilityId, float] | None = None,
    player_id: int = 1,
    built_round: int = 1,
    fuel: dict[Fuel, float] | None = None,
) -> Bidder:
    return Bidder(
        player_id=player_id,
        owned_facilities=[OwnedFacility(facility=facility, built_round=built_round) for facility in facilities],
        prices=_prices(sell or {}, buy),
        stored_energy=stored_energy or {},
        fuel=fuel,
    )


def _simulate(
    *bidders: Bidder,
    share: float = 1.0,
    clearings_per_day: ClearingsPerDay = 24,
    trading_format: TradingFormat = "representative_week",
) -> TradingOutcome:
    return simulate_trading_period(
        list(bidders),
        round_number=1,
        season="spring",
        round_format=RoundFormat(trading_format=trading_format, clearings_per_day=clearings_per_day),
        amplitude=_AMPLITUDE,
        curve=_FLAT,
        weather=steady(share),
    )


def _mwh_value(megawatts: float, price: float) -> float:
    """What ``megawatts`` sustained all day is worth at ``price``, scaled to the Trading period."""
    return megawatts * _HOURS * price * SEASON_DAYS


def test_a_season_is_thirteen_weeks_and_a_year_four_seasons() -> None:
    assert SEASON_DAYS == 13 * 7
    assert DAYS_PER_YEAR == 4 * SEASON_DAYS


def test_a_controllable_facility_sells_at_the_clearing_price_and_the_week_is_scaled_to_the_season() -> None:
    # 11 MW at 100 runs out before demand willing to pay 120 does, so the market clears 11 MW at 120.
    outcome = _simulate(_bidder(GAS, sell={GAS: 100.0}))

    gas = outcome.results[1].facilities[GAS]
    assert gas.revenue == pytest.approx(_mwh_value(11, 120))
    assert gas.generation == pytest.approx(11e6 * _HOURS * SEASON_DAYS)
    assert gas.sold == pytest.approx(gas.generation)
    assert gas.dumped == 0
    assert gas.capacity_factor == pytest.approx(1.0)
    assert not outcome.blackout


def test_a_controllable_facility_produces_only_what_it_sells() -> None:
    # At 200 the 11 MW gas burner meets demand only up to the 120 tier: 10.5 MW at 200.
    outcome = _simulate(_bidder(GAS, sell={GAS: 200.0}))

    gas = outcome.results[1].facilities[GAS]
    assert gas.revenue == pytest.approx(_mwh_value(10.5, 200))
    assert gas.generation == pytest.approx(10.5e6 * _HOURS * SEASON_DAYS)
    assert gas.dumped == 0
    assert gas.capacity_factor == pytest.approx(10.5 / 11)


def test_each_facility_type_is_offered_at_its_own_price() -> None:
    # The cheaper combined cycle alone meets the 14.5 MW of demand willing to pay at least its 20.
    outcome = _simulate(_bidder(GAS, COMBINED_CYCLE, sell={GAS: 30.0, COMBINED_CYCLE: 20.0}))

    facilities = outcome.results[1].facilities
    assert facilities[COMBINED_CYCLE].sold == pytest.approx(14.5e6 * _HOURS * SEASON_DAYS)
    assert facilities[GAS].sold == 0
    assert facilities[GAS].capacity_factor == 0


def test_several_facilities_of_a_type_are_offered_together() -> None:
    outcome = _simulate(_bidder(GAS, GAS, sell={GAS: 0.0}))

    gas = outcome.results[1].facilities[GAS]
    assert gas.sold == pytest.approx(16.5e6 * _HOURS * SEASON_DAYS)
    assert gas.capacity_factor == pytest.approx(16.5 / 22)


def test_a_renewable_produces_its_whole_output_and_dumps_what_does_not_sell() -> None:
    # The gas burner clears the market at 120. The wind turbine asks 500, so none of its 11 MW sells.
    outcome = _simulate(_bidder(GAS, WIND, sell={GAS: 100.0, WIND: 500.0}))

    wind = outcome.results[1].facilities[WIND]
    assert wind.sold == 0
    assert wind.dumped == pytest.approx(11e6 * _HOURS * SEASON_DAYS)
    assert wind.generation == wind.dumped
    assert wind.dump_cost == pytest.approx(_mwh_value(11, DUMP_COST))
    assert wind.capacity_factor == pytest.approx(1.0)


def test_a_renewable_produces_what_the_weather_gives_it() -> None:
    outcome = _simulate(_bidder(GAS, WIND, sell={GAS: 100.0, WIND: 500.0}), share=0.4)

    wind = outcome.results[1].facilities[WIND]
    assert wind.generation == pytest.approx(0.4 * 11e6 * _HOURS * SEASON_DAYS)
    assert wind.capacity_factor == pytest.approx(0.4)


def test_storage_discharges_what_it_sells_and_keeps_the_rest() -> None:
    # The full batteries offer at 0 and clear the 16.5 MW willing to pay at least 0. Their buy price
    # sits at the floor, below the clearing price, so they never charge.
    full = _BATTERY_CAPACITY
    outcome = _simulate(
        _bidder(BATTERIES, sell={BATTERIES: 0.0}, buy={BATTERIES: -25.0}, stored_energy={BATTERIES: full}),
        trading_format="full_season",
    )

    assert outcome.record.generation[0, 0] == pytest.approx(16.5e6)
    drawn = 16.5e6 / math.sqrt(_BATTERY_EFFICIENCY)
    assert outcome.record.stored[0, 0] == pytest.approx(full - drawn)


def test_storage_charges_what_it_buys_and_stores_it_for_the_next_period() -> None:
    # 130 MW of wind at -25 floods the market, which clears at -25. The empty batteries bid 100 for their
    # whole 86 MW, so they charge at full power, and are paid for it.
    outcome = _simulate(
        _bidder(OFFSHORE_WIND, BATTERIES, sell={OFFSHORE_WIND: -25.0}, buy={BATTERIES: 100.0}),
        trading_format="full_season",
    )

    assert outcome.record.charged[1, 0] == pytest.approx(86e6)
    assert outcome.results[1].facilities[BATTERIES].purchase_cost < 0
    assert outcome.stored_energy[1] == {BATTERIES: pytest.approx(_BATTERY_CAPACITY)}


def test_nothing_stored_carries_over_into_a_representative_week() -> None:
    # The full batteries would sell at 0, but the week starts from its cyclic charge. They never charge, since
    # their buy price sits at the floor, so the week starts and ends empty.
    outcome = _simulate(
        _bidder(BATTERIES, sell={BATTERIES: 0.0}, buy={BATTERIES: -25.0}, stored_energy={BATTERIES: _BATTERY_CAPACITY})
    )

    assert outcome.results[1].facilities[BATTERIES].sold == 0
    assert outcome.stored_energy[1] == {}


def test_a_representative_week_starts_from_the_charge_its_first_pass_ended_with() -> None:
    # The batteries charge at full power from the cheap wind and never discharge, since they ask 500. 86 MW fills
    # them in under two days, so the first pass ends full, and the week that counts starts full and buys nothing.
    bidder = _bidder(OFFSHORE_WIND, BATTERIES, sell={OFFSHORE_WIND: -25.0, BATTERIES: 500.0}, buy={BATTERIES: 100.0})

    outcome = _simulate(bidder)

    batteries = outcome.results[1].facilities[BATTERIES]
    assert batteries.bought == 0
    assert outcome.record.stored[1, 0] == pytest.approx(_BATTERY_CAPACITY)
    assert outcome.stored_energy[1] == {BATTERIES: pytest.approx(_BATTERY_CAPACITY)}


def test_storage_never_holds_more_than_its_capacity() -> None:
    capacity = _BATTERY_CAPACITY
    outcome = _simulate(
        _bidder(
            OFFSHORE_WIND,
            BATTERIES,
            sell={OFFSHORE_WIND: -25.0},
            buy={BATTERIES: 100.0},
            stored_energy={BATTERIES: capacity * 0.9},
        ),
        trading_format="full_season",
    )

    assert outcome.stored_energy[1][BATTERIES] == pytest.approx(capacity, rel=1e-6)
    assert outcome.stored_energy[1][BATTERIES] <= capacity


def test_a_facility_under_construction_produces_nothing_and_owes_no_om() -> None:
    # A nuclear reactor built in Round 1 works from Round 2.
    outcome = _simulate(_bidder(GAS, sell={GAS: 100.0}), _bidder(REACTOR, sell={REACTOR: 0.0}, player_id=2))

    assert 2 not in outcome.results


def test_om_is_one_trading_periods_share_and_not_scaled() -> None:
    outcome = _simulate(_bidder(GAS, sell={GAS: 200.0}))

    owned = OwnedFacility(facility=GAS, built_round=1)
    expected = om_owed(owned, current_round=1, production=[10.5e6] * 24)
    assert outcome.results[1].facilities[GAS].om == pytest.approx(expected)


def test_om_is_split_into_its_fixed_part_and_its_variable_part_at_full_use() -> None:
    outcome = _simulate(_bidder(GAS, GAS, sell={GAS: 200.0}))

    gas = outcome.results[1].facilities[GAS]
    assert gas.count == 2
    assert gas.om == pytest.approx(gas.om_fixed + gas.om_variable_full * gas.capacity_factor)
    assert gas.om_fixed + gas.om_variable_full == pytest.approx(2 * CATALOG[GAS].om_per_round / 4)


def test_the_period_result_totals_its_facilities() -> None:
    outcome = _simulate(_bidder(GAS, WIND, sell={GAS: 100.0, WIND: 500.0}))

    result = outcome.results[1]
    gas, wind = result.facilities[GAS], result.facilities[WIND]
    assert result.revenue == pytest.approx(gas.revenue)
    assert result.net == pytest.approx(gas.revenue - wind.dump_cost - gas.om - wind.om)
    assert (result.round, result.season) == (1, "spring")


def test_emissions_follow_generation() -> None:
    outcome = _simulate(_bidder(GAS, sell={GAS: 100.0}))

    assert outcome.results[1].facilities[GAS].emissions == pytest.approx(
        CATALOG[GAS].base_pollution * 11 * _HOURS * SEASON_DAYS
    )


def test_fuel_burned_follows_generation() -> None:
    outcome = _simulate(_bidder(GAS, sell={GAS: 100.0}))

    assert outcome.results[1].facilities[GAS].fuel_burned == pytest.approx(FUEL_USE[GAS] * 11 * _HOURS * SEASON_DAYS)


def test_a_facility_that_burns_nothing_burns_no_fuel() -> None:
    outcome = _simulate(_bidder(WIND))

    assert outcome.results[1].facilities[WIND].fuel_burned == 0.0


def test_the_engine_buys_no_fuel_the_session_pays_for_it() -> None:
    outcome = _simulate(_bidder(GAS, sell={GAS: 100.0}))

    assert outcome.results[1].fuel == []


def test_a_results_fuel_comes_off_what_it_added_to_the_players_money() -> None:
    result = _simulate(_bidder(GAS, sell={GAS: 100.0})).results[1]
    fuel = [
        FuelPurchase(fuel=Fuel.GAS, quantity=1_000.0, price=0.5),
        FuelPurchase(fuel=Fuel.GAS, quantity=10.0, price=2.0),
    ]

    with_fuel = result.model_copy(update={"fuel": fuel})

    assert with_fuel.fuel_cost == pytest.approx(520.0)
    assert with_fuel.net == pytest.approx(result.net - 520.0)


# Fuel stock (#1010). A gas burner at full output burns this much gas over one simulated day.
_GAS_PER_DAY = FUEL_USE[GAS] * 11 * _HOURS


def test_fuel_never_runs_short_when_the_bidder_has_no_fuel_limit() -> None:
    outcome = _simulate(_bidder(GAS, sell={GAS: 100.0}))

    gas = outcome.results[1].facilities[GAS]
    assert gas.generation == pytest.approx(11e6 * _HOURS * SEASON_DAYS)
    assert not gas.ran_out_of_fuel


def test_enough_fuel_does_not_hold_back_output() -> None:
    outcome = _simulate(_bidder(GAS, sell={GAS: 100.0}, fuel={Fuel.GAS: _GAS_PER_DAY * SEASON_DAYS}))

    gas = outcome.results[1].facilities[GAS]
    assert gas.generation == pytest.approx(11e6 * _HOURS * SEASON_DAYS)
    assert not gas.ran_out_of_fuel


def test_a_representative_week_burns_its_share_of_the_stock_and_then_stops() -> None:
    # Half the season's fuel: the representative week gets half a week's worth, so it runs for three and a half
    # days. Its first pass, for the storage's cyclic start, burns none of it.
    stock = _GAS_PER_DAY * SEASON_DAYS / 2

    outcome = _simulate(_bidder(GAS, sell={GAS: 100.0}, fuel={Fuel.GAS: stock}))

    gas = outcome.results[1].facilities[GAS]
    assert gas.fuel_burned == pytest.approx(stock)
    assert gas.generation == pytest.approx(11e6 * _HOURS * SEASON_DAYS / 2)
    assert gas.ran_out_of_fuel


def test_a_full_season_burns_the_stock_day_by_day_and_then_stops() -> None:
    stock = _GAS_PER_DAY * SEASON_DAYS / 2

    outcome = _simulate(_bidder(GAS, sell={GAS: 100.0}, fuel={Fuel.GAS: stock}), trading_format="full_season")

    gas = outcome.results[1].facilities[GAS]
    assert gas.fuel_burned == pytest.approx(stock)
    assert gas.generation == pytest.approx(11e6 * _HOURS * SEASON_DAYS / 2)
    assert gas.ran_out_of_fuel
    generation = outcome.record.generation[0]
    assert generation[0] == pytest.approx(11e6)
    assert generation[-1] == 0.0


def test_no_fuel_means_no_output() -> None:
    outcome = _simulate(_bidder(GAS, sell={GAS: 100.0}, fuel={}))

    gas = outcome.results[1].facilities[GAS]
    assert gas.generation == 0.0
    assert gas.fuel_burned == 0.0
    assert gas.ran_out_of_fuel


def test_facility_types_burning_the_same_fuel_never_burn_more_than_the_stock() -> None:
    # One hour of a gas burner's gas, shared with a combined cycle. Whichever offers first reserves what it
    # could burn, so the other cannot offer the same gas.
    stock = FUEL_USE[GAS] * 11 * SEASON_DAYS
    bidder = _bidder(GAS, COMBINED_CYCLE, sell={GAS: 10.0, COMBINED_CYCLE: 10.0}, fuel={Fuel.GAS: stock})

    outcome = _simulate(bidder)

    facilities = outcome.results[1].facilities
    assert facilities[GAS].fuel_burned + facilities[COMBINED_CYCLE].fuel_burned == pytest.approx(stock)
    assert facilities[GAS].ran_out_of_fuel
    assert facilities[COMBINED_CYCLE].ran_out_of_fuel


def test_the_cheaper_facility_type_gets_the_shared_fuel_first() -> None:
    # Just the coal the modern coal plant burns on its own. The coal burner comes first in the fleet but asks too
    # much to sell, so it must not hold any of that coal back from the modern coal plant.
    modern = FacilityId.MODERN_COAL_PLANT
    burner = FacilityId.COAL_BURNER
    stock = _simulate(_bidder(modern, sell={modern: 10.0})).results[1].facilities[modern].fuel_burned

    outcome = _simulate(_bidder(burner, modern, sell={burner: 5_000.0, modern: 10.0}, fuel={Fuel.COAL: stock}))

    facilities = outcome.results[1].facilities
    assert facilities[modern].fuel_burned == pytest.approx(stock)
    assert facilities[burner].fuel_burned == 0.0
    assert not facilities[burner].ran_out_of_fuel


def test_an_offer_priced_out_of_the_market_has_not_run_out_of_fuel() -> None:
    # The offshore wind farm covers the demand, so the grid holds without the gas burner.
    outcome = _simulate(_bidder(GAS, OFFSHORE_WIND, sell={GAS: 5_000.0, OFFSHORE_WIND: 0.0}, fuel={}))

    assert not outcome.results[1].facilities[GAS].ran_out_of_fuel


def test_a_result_names_the_fuels_that_ran_out() -> None:
    # The gas burner asks nothing, so it would sell if it had gas.
    bidder = _bidder(GAS, FacilityId.COAL_BURNER, WIND, sell={GAS: 0.0}, fuel={Fuel.COAL: 1e15})

    result = _simulate(bidder).results[1]

    assert result.fuels_run_out == {Fuel.GAS}


def test_a_facility_that_burns_no_fuel_is_not_limited_by_the_stock() -> None:
    outcome = _simulate(_bidder(WIND, sell={WIND: 0.0}, fuel={}))

    wind = outcome.results[1].facilities[WIND]
    assert wind.generation == pytest.approx(11e6 * _HOURS * SEASON_DAYS)
    assert not wind.ran_out_of_fuel


def test_clearing_more_often_settles_the_same_steady_week() -> None:
    hourly = _simulate(_bidder(GAS, sell={GAS: 100.0}), clearings_per_day=24)
    five_minutely = _simulate(_bidder(GAS, sell={GAS: 100.0}), clearings_per_day=288)

    assert five_minutely.results[1].revenue == pytest.approx(hourly.results[1].revenue)


def test_players_compete_on_one_market() -> None:
    # Bob's gas burner at 10 undercuts Alice's at 100.
    alice = _bidder(GAS, sell={GAS: 100.0}, player_id=1)
    bob = _bidder(GAS, sell={GAS: 10.0}, player_id=2)

    outcome = _simulate(alice, bob)

    # Demand willing to pay at least 100 is 12.5 MW. Bob sells 11, Alice the remaining 1.5, all at 100.
    assert outcome.results[2].facilities[GAS].revenue == pytest.approx(_mwh_value(11, 100))
    assert outcome.results[1].facilities[GAS].revenue == pytest.approx(_mwh_value(1.5, 100))


def _calm_from_hour(hour: int, share: float) -> FixedWeather:
    """Weather under which every renewable produces all its power, until ``hour`` of each day, then ``share``."""
    return FixedWeather(lambda _facility, seconds: 1.0 if seconds % 86_400 < hour * 3_600 else share)


def test_unserved_must_serve_demand_is_a_blackout_and_nothing_is_produced_from_then_on() -> None:
    # 8 MW of demand must be served. The 11 MW wind turbine sells all its output at 120 until noon on the
    # week's first day, then the wind drops to 30%, and its 3.3 MW cannot meet must-serve demand. The grid goes
    # down at noon.
    outcome = simulate_trading_period(
        [_bidder(WIND, sell={WIND: 0.0})],
        round_number=1,
        season="spring",
        round_format=RoundFormat(),
        amplitude=_AMPLITUDE,
        curve=_FLAT,
        weather=_calm_from_hour(12, 0.3),
    )

    assert outcome.blackout
    wind = outcome.results[1].facilities[WIND]
    assert wind.revenue == pytest.approx(11 * 12 * 120 * _WEEKS)
    assert wind.generation == wind.sold == pytest.approx(11e6 * 12 * _WEEKS)
    assert wind.dumped == 0
    assert wind.capacity_factor == pytest.approx(12 / (7 * 24))


def test_a_blackout_at_the_first_clearing_leaves_storage_as_it_was() -> None:
    # The wind's 3.3 MW cannot meet the 8 MW must-serve demand, and the empty batteries hold nothing.
    outcome = _simulate(
        _bidder(WIND, BATTERIES, sell={WIND: 0.0}, buy={BATTERIES: 1_000.0}, stored_energy={BATTERIES: 1.0}),
        share=0.3,
        trading_format="full_season",
    )

    assert outcome.blackout
    assert outcome.stored_energy[1] == {BATTERIES: 1.0}
    performances = outcome.results[1].facilities.values()
    assert all(
        (performance.generation, performance.bought, performance.revenue, performance.purchase_cost) == (0, 0, 0, 0)
        for performance in performances
    )


def test_a_blackout_ends_a_full_season_on_the_day_it_happens() -> None:
    # Days 0 and 1 of spring are calm. On day 2 the wind drops to 30% at noon and the grid goes down.
    third_day = season_days("spring")[2] * 86_400

    def weather(_facility: FacilityId, seconds: float) -> float:
        return 1.0 if seconds < third_day + 12 * 3_600 else 0.3

    reported: list[int] = []
    outcome = simulate_trading_period(
        [_bidder(WIND, sell={WIND: 0.0})],
        round_number=1,
        season="spring",
        round_format=RoundFormat(trading_format="full_season"),
        amplitude=_AMPLITUDE,
        curve=_FLAT,
        weather=FixedWeather(weather),
        on_day_done=reported.append,
    )

    assert outcome.blackout
    wind = outcome.results[1].facilities[WIND]
    assert wind.revenue == pytest.approx(11 * 60 * 120)
    assert wind.capacity_factor == pytest.approx(60 / (24 * SEASON_DAYS))
    # The days after the blackout are skipped, and still count as done.
    assert reported == list(range(1, SEASON_DAYS + 1))


def test_supply_exactly_meeting_must_serve_demand_is_no_blackout_and_settles_at_the_scarcity_price() -> None:
    # Wind at 8/11 of its 11 MW gives exactly the 8 MW of must-serve demand, so the market clears at the
    # unbounded must-serve bid without leaving any of it unserved.
    outcome = _simulate(_bidder(WIND, sell={WIND: 0.0}), share=8 / 11)

    assert not outcome.blackout
    wind = outcome.results[1].facilities[WIND]
    assert wind.revenue == pytest.approx(_mwh_value(8, SCARCITY_PRICE))


def test_a_player_with_nothing_operating_gets_no_result() -> None:
    outcome = _simulate(_bidder(GAS, sell={GAS: 100.0}), _bidder(player_id=2))

    assert set(outcome.results) == {1}


# --- seasons ------------------------------------------------------------------------------------


def test_the_seasons_cover_the_year_once_spring_first_from_the_monday_closest_to_the_first_of_march() -> None:
    days = [day for season in ("spring", "summer", "autumn", "winter") for day in season_days(season)]

    assert days[0] == 56
    assert sorted(days) == list(range(DAYS_PER_YEAR))
    assert all(len(season_days(season)) == SEASON_DAYS for season in SEASONS)


def test_winter_runs_over_the_end_of_the_year() -> None:
    winter = season_days("winter")

    assert winter[0] == 329
    assert winter[34:36] == [363, 0]
    assert winter[-1] == 55


# Full-season mode (#1004). With a flat curve and steady weather every day is the same, so 91 literal days
# add up to what one representative week scaled ×13 gives.


@pytest.mark.parametrize("clearings_per_day", [24, 96])
def test_a_full_season_of_steady_days_adds_up_to_the_scaled_representative_week(
    clearings_per_day: ClearingsPerDay,
) -> None:
    bidder = _bidder(GAS, WIND, sell={GAS: 100.0, WIND: 500.0})

    representative = _simulate(bidder, clearings_per_day=clearings_per_day)
    full_season = _simulate(bidder, clearings_per_day=clearings_per_day, trading_format="full_season")

    for facility, performance in representative.results[1].facilities.items():
        simulated = full_season.results[1].facilities[facility]
        for name, value in performance.model_dump().items():
            assert getattr(simulated, name) == pytest.approx(value), (facility, name)


def test_a_full_season_clears_every_day_of_the_season() -> None:
    times: set[float] = set()

    def recorded(_facility: FacilityId, seconds: float) -> float:
        times.add(seconds)
        return 1.0

    simulate_trading_period(
        [_bidder(WIND, sell={WIND: 0.0})],
        round_number=1,
        season="winter",
        round_format=RoundFormat(trading_format="full_season"),
        amplitude=_AMPLITUDE,
        curve=_FLAT,
        weather=FixedWeather(recorded),
    )

    assert sorted({int(seconds // 86_400) for seconds in times}) == sorted(season_days("winter"))
    assert len(times) == SEASON_DAYS * 24


def test_storage_keeps_its_charge_from_one_day_to_the_next_in_a_full_season() -> None:
    # The empty batteries charge at full power from the cheap wind and never discharge, since they ask 500.
    # 86 MW fills them in under two days, so over the season they buy their capacity and no more.
    bidder = _bidder(OFFSHORE_WIND, BATTERIES, sell={OFFSHORE_WIND: -25.0, BATTERIES: 500.0}, buy={BATTERIES: 100.0})

    outcome = _simulate(bidder, trading_format="full_season")

    batteries = outcome.results[1].facilities[BATTERIES]
    assert batteries.bought == pytest.approx(_BATTERY_CAPACITY / math.sqrt(_BATTERY_EFFICIENCY))
    assert outcome.stored_energy[1] == {BATTERIES: pytest.approx(_BATTERY_CAPACITY)}


def test_om_is_the_same_in_a_full_season() -> None:
    representative = _simulate(_bidder(GAS, sell={GAS: 200.0}))
    full_season = _simulate(_bidder(GAS, sell={GAS: 200.0}), trading_format="full_season")

    assert full_season.results[1].facilities[GAS].om == pytest.approx(representative.results[1].facilities[GAS].om)


@pytest.mark.parametrize(("trading_format", "days"), [("representative_week", 14), ("full_season", 91)])
def test_the_engine_reports_each_day_it_has_cleared(trading_format: TradingFormat, days: int) -> None:
    reported: list[int] = []

    simulate_trading_period(
        [_bidder(GAS, sell={GAS: 100.0})],
        round_number=1,
        season="spring",
        round_format=RoundFormat(trading_format=trading_format),
        amplitude=_AMPLITUDE,
        curve=_FLAT,
        weather=steady(1.0),
        on_day_done=reported.append,
    )

    assert reported == list(range(1, days + 1))
    assert cleared_day_count("spring", RoundFormat(trading_format=trading_format)) == days


def test_the_peak_demand_is_the_most_the_market_cleared_at_one_settlement_point() -> None:
    # Demand is half as high again in the second half of each day, so the market clears more then.
    outcome = simulate_trading_period(
        [_bidder(WIND, GAS, sell={WIND: 0.0, GAS: 1_000.0})],
        round_number=1,
        season="spring",
        round_format=RoundFormat(),
        amplitude=_AMPLITUDE,
        curve=DemandCurve((1.0, 1.5) * DAYS_PER_YEAR),
        weather=steady(1.0),
    )

    assert not outcome.blackout
    assert outcome.peak_demand is not None
    assert outcome.peak_demand == pytest.approx(float(np.nanmax(outcome.record.quantity)))
    assert outcome.peak_demand > float(np.nanmin(outcome.record.quantity))


def test_a_blackout_at_the_first_clearing_leaves_no_peak_demand() -> None:
    outcome = _simulate(_bidder(WIND, sell={WIND: 0.0}), share=0.3)

    assert outcome.blackout
    assert outcome.peak_demand is None


# Representative-week mode (#1198, ADR-0008).


def _times_cleared(trading_format: TradingFormat) -> tuple[set[int], dict[str, int]]:
    """The days of the year the engine clears, and how many clearings read the season's own weather and the
    week's borrowed weather.
    """
    days: set[int] = set()
    reads = {"season": 0, "week": 0}

    def reading(weather: str):
        def shares(_facility: FacilityId, seconds: float) -> float:
            days.add(int(seconds // 86_400))
            reads[weather] += 1
            return 1.0

        return shares

    simulate_trading_period(
        [_bidder(WIND, sell={WIND: 0.0})],
        round_number=1,
        season="summer",
        round_format=RoundFormat(trading_format=trading_format),
        amplitude=_AMPLITUDE,
        curve=_FLAT,
        weather=FixedWeather(reading("season"), week=reading("week")),
    )
    return days, reads


def test_a_representative_week_clears_the_middle_week_of_the_season_under_its_borrowed_weather() -> None:
    days, reads = _times_cleared("representative_week")

    assert days == set(representative_week("summer"))
    # Cleared twice: once for the storage's cyclic start, once for the week that counts.
    assert reads == {"season": 0, "week": 2 * 7 * 24}


def test_a_full_season_clears_under_the_seasons_own_weather() -> None:
    days, reads = _times_cleared("full_season")

    assert days == set(season_days("summer"))
    assert reads == {"season": SEASON_DAYS * 24, "week": 0}


# Demand that grows faster and faster through the year, so the middle week of spring has less demand than the
# season on average. Each day has three values: night, morning and evening.
_PEAKED = DemandCurve(
    tuple(level * (1 + (day / DAYS_PER_YEAR) ** 2) for day in range(DAYS_PER_YEAR) for level in (1.0, 0.8, 1.2))
)


def _average_demand(days: list[int], scale: float = 1.0) -> float:
    demands = [nominal_demand(scale, _PEAKED, SettlementPeriod(day, hour, 24)) for day in days for hour in range(24)]
    return sum(demands) / len(demands)


def test_a_representative_weeks_demand_is_scaled_to_the_seasons_average() -> None:
    scale = demand_scale("spring", RoundFormat(), _PEAKED)

    assert scale != pytest.approx(1.0)
    assert _average_demand(representative_week("spring"), scale) == pytest.approx(
        _average_demand(season_days("spring"))
    )


def test_a_full_seasons_demand_is_not_scaled() -> None:
    assert demand_scale("spring", RoundFormat(trading_format="full_season"), _PEAKED) == 1.0


def test_a_representative_week_sells_what_the_whole_season_would_with_steady_supply() -> None:
    # The 54 MW combined cycle covers every tier willing to pay at least 0, whatever the demand, so what it sells
    # is a fixed share of demand. Scaled to the season's average, the week sells what the season does.
    def sold(trading_format: TradingFormat) -> float:
        outcome = simulate_trading_period(
            [_bidder(COMBINED_CYCLE, sell={COMBINED_CYCLE: 0.0})],
            round_number=1,
            season="spring",
            round_format=RoundFormat(trading_format=trading_format),
            amplitude=_AMPLITUDE,
            curve=_PEAKED,
            weather=steady(1.0),
        )
        return outcome.results[1].facilities[COMBINED_CYCLE].sold

    assert sold("representative_week") == pytest.approx(sold("full_season"))


def test_the_record_keeps_the_seasons_average_output() -> None:
    average = AverageOutput(wind=0.31, solar=0.17)
    outcome = simulate_trading_period(
        [_bidder(GAS, sell={GAS: 100.0})],
        round_number=1,
        season="spring",
        round_format=RoundFormat(),
        amplitude=_AMPLITUDE,
        curve=_FLAT,
        weather=FixedWeather(lambda _facility, _seconds: 1.0, average_output=average),
    )

    assert outcome.record.average_output == average


def test_a_blackout_in_the_first_pass_does_not_stop_it_finding_the_cyclic_charge() -> None:
    # Calm for the first four hours of each day: the 11 MW wind gives 3.3 MW, short of the 8 MW must-serve demand,
    # and the batteries must make up the rest from what they bought by day. The first pass starts empty, so it
    # goes down at its first clearing, but it keeps clearing to find the charge the week cycles through.
    # They ask more than they bid, so they never buy back their own power.
    bidder = _bidder(WIND, BATTERIES, sell={WIND: 0.0, BATTERIES: 600.0}, buy={BATTERIES: 500.0})

    outcome = simulate_trading_period(
        [bidder],
        round_number=1,
        season="spring",
        round_format=RoundFormat(),
        amplitude=_AMPLITUDE,
        curve=_FLAT,
        weather=FixedWeather(lambda _facility, seconds: 0.3 if seconds % 86_400 < 4 * 3_600 else 1.0),
    )

    assert not outcome.blackout
