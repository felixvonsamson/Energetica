"""The Trading-period engine (#1003, #1004).

In representative-day mode, one simulated day is cleared through ``sim``'s market and settled by ``sim``'s
rules, then scaled ×91 into the Trading period's total. In full-season mode, all 91 days of the season are
cleared and added up. These tests use a flat demand curve and steady weather, so every
clearing of the day is the same and each figure can be worked out by hand.

With a flat curve and an amplitude of 10 MW, the demand block bids 8 MW at any price (must-serve), then
1 MW up to 480, 1.5 MW up to 240, 2 MW up to 120, 2 MW up to 24 and 2 MW up to 5.
"""

from __future__ import annotations

import math

import pytest

from energetica.sim.national_demand import DemandCurve
from energetica.workshop.facilities import CATALOG, FacilityId
from energetica.workshop.fleet import OwnedFacility, om_owed
from energetica.workshop.prices import DEFAULT_PRICES, DUMP_COST, PriceSheet
from energetica.workshop.round_format import ClearingsPerDay, RoundFormat, TradingFormat
from energetica.workshop.trading import (
    SCARCITY_PRICE,
    DAYS_PER_YEAR,
    REPRESENTATIVE_DAYS,
    SEASON_DAYS,
    Bidder,
    season_days,
    TradingOutcome,
    representative_weather,
    simulate_trading_period,
)

_FLAT = DemandCurve(intraday=(1.0,), seasonal=(1.0,))
_AMPLITUDE = 10e6
_HOURS = 24

GAS = FacilityId.GAS_BURNER  # 11 MW
COMBINED_CYCLE = FacilityId.COMBINED_CYCLE  # 54 MW
WIND = FacilityId.ONSHORE_WIND_TURBINE  # 11 MW
OFFSHORE_WIND = FacilityId.OFFSHORE_WIND_TURBINE  # 130 MW
BATTERIES = FacilityId.LITHIUM_ION_BATTERIES  # 86 MW, 3.2 GWh, 69% efficient
REACTOR = FacilityId.NUCLEAR_REACTOR  # one Round to build

_BATTERY_CAPACITY = CATALOG[BATTERIES].base_storage_capacity or 0.0
_BATTERY_EFFICIENCY = CATALOG[BATTERIES].base_efficiency or 0.0


def _steady(share: float):
    """Weather under which every renewable produces ``share`` of its power all day."""
    return lambda _facility, _seconds: share


def _prices(sell: dict[FacilityId, float], buy: dict[FacilityId, float] | None = None) -> PriceSheet:
    return PriceSheet(sell={**DEFAULT_PRICES.sell, **sell}, buy={**DEFAULT_PRICES.buy, **(buy or {})})


def _bidder(
    *facilities: FacilityId,
    sell: dict[FacilityId, float] | None = None,
    buy: dict[FacilityId, float] | None = None,
    stored_energy: dict[FacilityId, float] | None = None,
    player_id: int = 1,
    built_round: int = 1,
) -> Bidder:
    return Bidder(
        player_id=player_id,
        owned_facilities=[OwnedFacility(facility=facility, built_round=built_round) for facility in facilities],
        prices=_prices(sell or {}, buy),
        stored_energy=stored_energy or {},
    )


def _simulate(
    *bidders: Bidder,
    share: float = 1.0,
    clearings_per_day: ClearingsPerDay = 24,
    trading_format: TradingFormat = "representative_day",
) -> TradingOutcome:
    return simulate_trading_period(
        list(bidders),
        round_number=1,
        season="spring",
        round_format=RoundFormat(trading_format=trading_format, clearings_per_day=clearings_per_day),
        amplitude=_AMPLITUDE,
        curve=_FLAT,
        weather=_steady(share),
    )


def _mwh_value(megawatts: float, price: float) -> float:
    """What ``megawatts`` sustained all day is worth at ``price``, scaled to the Trading period."""
    return megawatts * _HOURS * price * SEASON_DAYS


def test_a_season_is_thirteen_weeks_and_a_year_four_seasons() -> None:
    assert SEASON_DAYS == 13 * 7
    assert DAYS_PER_YEAR == 4 * SEASON_DAYS


def test_a_controllable_facility_sells_at_the_clearing_price_and_the_day_is_scaled_to_the_season() -> None:
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
        _bidder(BATTERIES, sell={BATTERIES: 0.0}, buy={BATTERIES: -25.0}, stored_energy={BATTERIES: full})
    )

    batteries = outcome.results[1].facilities[BATTERIES]
    assert batteries.sold == pytest.approx(16.5e6 * _HOURS * SEASON_DAYS)
    drawn = 16.5e6 * _HOURS / math.sqrt(_BATTERY_EFFICIENCY)
    assert outcome.stored_energy[1] == {BATTERIES: pytest.approx(full - drawn)}


def test_storage_charges_what_it_buys_and_stores_it_for_the_next_period() -> None:
    # 130 MW of wind at -25 floods the market, which clears at -25. The empty batteries bid 100 for their
    # whole 86 MW, so they charge at full power all day, and are paid for it.
    outcome = _simulate(_bidder(OFFSHORE_WIND, BATTERIES, sell={OFFSHORE_WIND: -25.0}, buy={BATTERIES: 100.0}))

    batteries = outcome.results[1].facilities[BATTERIES]
    assert batteries.bought == pytest.approx(86e6 * _HOURS * SEASON_DAYS)
    assert batteries.purchase_cost == pytest.approx(_mwh_value(86, -25))
    stored = 86e6 * _HOURS * math.sqrt(_BATTERY_EFFICIENCY)
    assert outcome.stored_energy[1] == {BATTERIES: pytest.approx(stored)}


def test_storage_never_holds_more_than_its_capacity() -> None:
    capacity = _BATTERY_CAPACITY
    outcome = _simulate(
        _bidder(
            OFFSHORE_WIND,
            BATTERIES,
            sell={OFFSHORE_WIND: -25.0},
            buy={BATTERIES: 100.0},
            stored_energy={BATTERIES: capacity * 0.9},
        )
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


def test_clearing_more_often_settles_the_same_steady_day() -> None:
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


def _calm_from_hour(hour: int, share: float):
    """Weather under which every renewable produces all its power, until ``hour`` of each day, then ``share``."""
    return lambda _facility, seconds: 1.0 if seconds % 86_400 < hour * 3_600 else share


def test_unserved_must_serve_demand_is_a_blackout_and_nothing_is_produced_from_then_on() -> None:
    # 8 MW of demand must be served. The 11 MW wind turbine sells all its output at 120 until noon, then
    # the wind drops to 30%, and its 3.3 MW cannot meet must-serve demand. The grid goes down at noon.
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
    assert wind.revenue == pytest.approx(11 * 12 * 120 * SEASON_DAYS)
    assert wind.generation == wind.sold == pytest.approx(11e6 * 12 * SEASON_DAYS)
    assert wind.dumped == 0
    assert wind.capacity_factor == pytest.approx(0.5)


def test_a_blackout_at_the_first_clearing_leaves_storage_as_it_was() -> None:
    # The wind's 3.3 MW cannot meet the 8 MW must-serve demand, and the empty batteries hold nothing.
    outcome = _simulate(
        _bidder(WIND, BATTERIES, sell={WIND: 0.0}, buy={BATTERIES: 1_000.0}, stored_energy={BATTERIES: 1.0}),
        share=0.3,
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
        weather=weather,
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


# --- weather -------------------------------------------------------------------------------------


@pytest.mark.parametrize("facility", [WIND, FacilityId.PV_SOLAR, FacilityId.CSP_SOLAR, FacilityId.SMALL_WATER_DAM])
def test_the_weather_gives_each_renewable_a_share_of_its_power(facility: FacilityId) -> None:
    weather = representative_weather(seed=7)

    shares = [weather(facility, REPRESENTATIVE_DAYS["summer"] * 86_400 + hour * 3_600) for hour in range(24)]

    assert all(0 <= share <= 1 for share in shares)


def test_the_sun_does_not_shine_at_midnight() -> None:
    weather = representative_weather(seed=7)

    assert weather(FacilityId.PV_SOLAR, REPRESENTATIVE_DAYS["summer"] * 86_400) == 0


def test_the_same_seed_gives_the_same_weather_and_another_seed_other_weather() -> None:
    noon = REPRESENTATIVE_DAYS["spring"] * 86_400 + 12 * 3_600
    winds = [representative_weather(seed)(WIND, noon) for seed in (1, 1, 2)]

    assert winds[0] == winds[1]
    assert winds[0] != winds[2]


def test_each_season_is_represented_by_its_middle_day() -> None:
    assert list(REPRESENTATIVE_DAYS) == ["spring", "summer", "autumn", "winter"]
    for season, day in REPRESENTATIVE_DAYS.items():
        assert season_days(season)[45] == day


def test_the_seasons_cover_the_year_once_spring_first_from_the_first_of_march() -> None:
    days = [day for season in ("spring", "summer", "autumn", "winter") for day in season_days(season)]

    assert days[0] == 59
    assert sorted(days) == list(range(DAYS_PER_YEAR))
    assert all(len(season_days(season)) == SEASON_DAYS for season in REPRESENTATIVE_DAYS)


def test_winter_runs_over_the_end_of_the_year() -> None:
    winter = season_days("winter")

    assert winter[0] == 332
    assert winter[31:33] == [363, 0]
    assert winter[-1] == 58


# Full-season mode (#1004). With a flat curve and steady weather every day is the same, so 91 literal days
# add up to what one representative day scaled ×91 gives.


@pytest.mark.parametrize("clearings_per_day", [24, 96])
def test_a_full_season_of_steady_days_adds_up_to_the_scaled_representative_day(
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
        weather=recorded,
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


@pytest.mark.parametrize(("trading_format", "days"), [("representative_day", 1), ("full_season", 91)])
def test_the_engine_reports_each_day_it_has_simulated(trading_format: TradingFormat, days: int) -> None:
    reported: list[int] = []

    simulate_trading_period(
        [_bidder(GAS, sell={GAS: 100.0})],
        round_number=1,
        season="spring",
        round_format=RoundFormat(trading_format=trading_format),
        amplitude=_AMPLITUDE,
        curve=_FLAT,
        weather=_steady(1.0),
        on_day_done=reported.append,
    )

    assert reported == list(range(1, days + 1))
