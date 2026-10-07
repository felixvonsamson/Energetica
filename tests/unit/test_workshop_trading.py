"""The Trading-period engine in representative-day mode (#1003).

One simulated day is cleared through ``sim``'s market and settled by ``sim``'s rules, then scaled ×365/4
into the Trading period's total. These tests use a flat demand curve and steady weather, so every
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
from energetica.workshop.trading import (
    REPRESENTATIVE_DAYS,
    SEASON_DAYS,
    Bidder,
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


def _simulate(*bidders: Bidder, share: float = 1.0, clearings_per_day: int = 24) -> TradingOutcome:
    return simulate_trading_period(
        list(bidders),
        round_number=1,
        season="spring",
        clearings_per_day=clearings_per_day,
        amplitude=_AMPLITUDE,
        curve=_FLAT,
        weather=_steady(share),
    )


def _mwh_value(megawatts: float, price: float) -> float:
    """What ``megawatts`` sustained all day is worth at ``price``, scaled to the Trading period."""
    return megawatts * _HOURS * price * SEASON_DAYS


def test_a_season_is_a_quarter_of_a_year() -> None:
    assert SEASON_DAYS == 365 / 4


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


def test_unserved_must_serve_demand_is_a_blackout_and_settles_nothing() -> None:
    # 8 MW of demand must be served, and one 11 MW wind turbine at 30% produces 3.3 MW.
    outcome = _simulate(_bidder(WIND, sell={WIND: 0.0}), share=0.3)

    assert outcome.blackout
    wind = outcome.results[1].facilities[WIND]
    assert (wind.revenue, wind.sold, wind.dumped) == (0, 0, 0)


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


def test_each_season_is_represented_by_a_day_inside_it() -> None:
    assert list(REPRESENTATIVE_DAYS) == ["spring", "summer", "autumn", "winter"]
    # Day 0 is the first of January, so spring starts on day 59 (1 March) and winter on day 334.
    assert 59 <= REPRESENTATIVE_DAYS["spring"] < 151
    assert 151 <= REPRESENTATIVE_DAYS["summer"] < 243
    assert 243 <= REPRESENTATIVE_DAYS["autumn"] < 334
    assert REPRESENTATIVE_DAYS["winter"] >= 334 or REPRESENTATIVE_DAYS["winter"] < 59
