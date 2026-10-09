"""Unit tests for Workshop's fuel market (#1009): seasonal prices and shocks, what a fleet needs for a season,
the default quantities and the stockpile limit.
"""

from __future__ import annotations

import math

import pytest

from energetica.workshop.facilities import CATALOG, FacilityId, Fuel
from energetica.workshop.fleet import OwnedFacility
from energetica.workshop.fuel import (
    CATALOG_FUEL_PRICES,
    FUEL_USE,
    MAX_STEP,
    STOCKPILE_SEASONS,
    FuelPrice,
    FuelPurchase,
    burned_fuels,
    capped_order,
    default_orders,
    next_fuel_price,
    season_need,
)
from energetica.workshop.trading import SEASON_DAYS


def _owned(facility: FacilityId, built_round: int = 1) -> OwnedFacility:
    return OwnedFacility(facility=facility, built_round=built_round)


# --- the catalog --------------------------------------------------------------------------------


def test_every_fuel_burning_facility_has_a_fuel_use_and_no_other_does() -> None:
    burning = {facility.id for facility in CATALOG.values() if facility.fuel_type is not None}

    assert set(FUEL_USE) == burning
    assert all(use > 0 for use in FUEL_USE.values())


def test_every_fuel_has_a_catalog_price() -> None:
    assert set(CATALOG_FUEL_PRICES) == set(Fuel)
    assert all(price > 0 for price in CATALOG_FUEL_PRICES.values())


# --- prices -------------------------------------------------------------------------------------


def test_the_first_price_steps_off_the_catalog_price() -> None:
    price = next_fuel_price(Fuel.COAL, None, seed=7, period_index=0)

    catalog = CATALOG_FUEL_PRICES[Fuel.COAL]
    assert price.previous_price is None
    assert catalog * (1 - MAX_STEP) <= price.price <= catalog * (1 + MAX_STEP)
    assert not price.shocked


def test_prices_follow_the_seed() -> None:
    first = next_fuel_price(Fuel.GAS, None, seed=7, period_index=3)

    assert next_fuel_price(Fuel.GAS, None, seed=7, period_index=3) == first
    assert next_fuel_price(Fuel.GAS, None, seed=8, period_index=3) != first
    assert next_fuel_price(Fuel.GAS, None, seed=7, period_index=4) != first


def test_each_fuel_moves_on_its_own() -> None:
    coal = next_fuel_price(Fuel.COAL, None, seed=7, period_index=0)
    gas = next_fuel_price(Fuel.GAS, None, seed=7, period_index=0)

    assert coal.drift != gas.drift


def test_a_season_moves_the_price_a_little_and_remembers_the_last_one() -> None:
    before = FuelPrice(fuel=Fuel.COAL, drift=1.0, shock=1.0, shocked=False, price=0.45, previous_price=None)

    after = next_fuel_price(Fuel.COAL, before, seed=7, period_index=1)

    assert after.previous_price == before.price
    assert abs(after.drift - 1.0) <= MAX_STEP


def test_prices_drift_back_toward_the_catalog_price() -> None:
    high = FuelPrice(fuel=Fuel.COAL, drift=1.5, shock=1.0, shocked=False, price=0.0, previous_price=None)

    after = next_fuel_price(Fuel.COAL, high, seed=7, period_index=1)

    # Half the gap closes each season, and one step cannot make up for it.
    assert after.drift <= 1.25 + MAX_STEP


def test_prices_stay_close_to_the_catalog_price_over_a_long_session() -> None:
    price = None
    for period_index in range(200):
        price = next_fuel_price(Fuel.GAS, price, seed=3, period_index=period_index)
        assert abs(price.drift - 1.0) <= 2 * MAX_STEP


def test_the_change_is_against_last_seasons_price() -> None:
    price = FuelPrice(fuel=Fuel.GAS, drift=1.0, shock=1.0, shocked=False, price=1.15, previous_price=1.0)

    assert price.change == pytest.approx(0.15)
    assert FuelPrice(fuel=Fuel.GAS, drift=1.0, shock=1.0, shocked=False, price=1.0, previous_price=None).change is None


def test_a_shock_lands_in_full_for_its_season() -> None:
    before = next_fuel_price(Fuel.GAS, None, seed=7, period_index=0)

    shocked = next_fuel_price(Fuel.GAS, before, seed=7, period_index=1, shock=1.65)

    assert shocked.shocked
    assert shocked.shock == 1.65
    assert shocked.price == pytest.approx(CATALOG_FUEL_PRICES[Fuel.GAS] * shocked.drift * 1.65)


def test_a_shock_eases_back_by_half_each_season_and_is_no_longer_new() -> None:
    price = next_fuel_price(Fuel.GAS, None, seed=7, period_index=0, shock=1.64)

    eased = next_fuel_price(Fuel.GAS, price, seed=7, period_index=1)
    eased_again = next_fuel_price(Fuel.GAS, eased, seed=7, period_index=2)

    assert not eased.shocked
    assert eased.shock == pytest.approx(1.32)
    assert eased_again.shock == pytest.approx(1.16)


def test_a_shock_that_has_almost_eased_off_is_gone() -> None:
    price = FuelPrice(fuel=Fuel.GAS, drift=1.0, shock=1.004, shocked=False, price=0.0, previous_price=None)

    assert next_fuel_price(Fuel.GAS, price, seed=7, period_index=1).shock == 1.0


def test_a_shock_can_bring_a_price_down() -> None:
    price = next_fuel_price(Fuel.URANIUM, None, seed=7, period_index=0, shock=0.5)

    assert price.price < CATALOG_FUEL_PRICES[Fuel.URANIUM] * (1 - MAX_STEP)


def test_a_shock_must_keep_the_price_positive() -> None:
    with pytest.raises(ValueError):
        next_fuel_price(Fuel.GAS, None, seed=7, period_index=0, shock=0.0)


# --- what a fleet burns ---------------------------------------------------------------------------


def test_a_fleet_burns_the_fuels_of_its_operating_facilities() -> None:
    fleet = [
        _owned(FacilityId.COAL_BURNER),
        _owned(FacilityId.SMALL_WATER_DAM),
        # Still under construction in Round 1, so it burns nothing yet.
        _owned(FacilityId.NUCLEAR_REACTOR),
    ]

    assert burned_fuels(fleet, current_round=1) == {Fuel.COAL}
    assert burned_fuels(fleet, current_round=2) == {Fuel.COAL, Fuel.URANIUM}


def test_the_season_need_is_every_facility_running_flat_out_all_season() -> None:
    fleet = [_owned(FacilityId.GAS_BURNER), _owned(FacilityId.GAS_BURNER), _owned(FacilityId.COMBINED_CYCLE)]

    need = season_need(Fuel.GAS, fleet, current_round=1)

    hours = SEASON_DAYS * 24
    expected = sum(
        CATALOG[owned.facility].base_power_generation / 1_000_000 * hours * FUEL_USE[owned.facility] for owned in fleet
    )
    assert need == pytest.approx(expected)
    assert season_need(Fuel.COAL, fleet, current_round=1) == 0.0


def test_a_facility_past_its_lifetime_needs_no_fuel() -> None:
    fleet = [_owned(FacilityId.GAS_BURNER, built_round=1)]

    assert season_need(Fuel.GAS, fleet, current_round=1 + CATALOG[FacilityId.GAS_BURNER].lifetime_rounds) == 0.0


# --- quantities ---------------------------------------------------------------------------------


def test_an_order_is_capped_so_the_stock_stays_within_the_limit() -> None:
    assert STOCKPILE_SEASONS == 3
    assert capped_order(100.0, stock=0.0, need=50.0) == 100.0
    assert capped_order(1_000.0, stock=0.0, need=50.0) == 150.0
    assert capped_order(100.0, stock=120.0, need=50.0) == 30.0
    # A stock already over the limit, after the fleet shrank, buys nothing.
    assert capped_order(100.0, stock=200.0, need=50.0) == 0.0


def test_the_first_default_buys_a_season_at_full_output() -> None:
    assert default_orders({}, needs={Fuel.COAL: 80.0}, stocks={}) == {Fuel.COAL: 80.0}


def test_after_that_the_default_repeats_the_last_purchase() -> None:
    orders = default_orders({Fuel.COAL: 30.0}, needs={Fuel.COAL: 80.0}, stocks={Fuel.COAL: 50.0})

    assert orders == {Fuel.COAL: 30.0}


def test_a_newly_burned_fuel_defaults_to_its_season_need_and_a_fuel_no_longer_burned_is_dropped() -> None:
    orders = default_orders({Fuel.COAL: 30.0}, needs={Fuel.GAS: 40.0}, stocks={Fuel.COAL: 10.0})

    assert orders == {Fuel.GAS: 40.0}


def test_a_default_is_capped_by_the_stockpile_limit() -> None:
    orders = default_orders({Fuel.COAL: 100.0}, needs={Fuel.COAL: 50.0}, stocks={Fuel.COAL: 120.0})

    assert orders == {Fuel.COAL: 30.0}


def test_a_purchase_costs_its_quantity_at_its_price() -> None:
    purchase = FuelPurchase(fuel=Fuel.COAL, quantity=1_000.0, price=0.5)

    assert purchase.cost == 500.0
    assert math.isfinite(purchase.cost)
