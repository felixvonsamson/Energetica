"""The relations between Workshop's facility values that the first recalibration (#1227) and the rebalance (#1306)
set.
"""

from __future__ import annotations

import statistics

from energetica.workshop.demand_block import DAYS_PER_YEAR
from energetica.workshop.facilities import (
    CATALOG,
    SESSION_LENGTH_PRICES,
    FacilityCategory,
    FacilityId,
    Fuel,
    session_price,
)
from energetica.workshop.fuel import CATALOG_FUEL_PRICES, FUEL_USE
from energetica.workshop.loan import LOAN_AMOUNT
from energetica.workshop.player import WORKSHOP_STARTING_BUDGET
from energetica.workshop.seasons import SEASONS
from energetica.workshop.unlocks import UPGRADES, unlock_threshold
from energetica.workshop.votes import CARBON_TAX_RATE
from energetica.workshop.weather import NORMAL_OUTPUT

HOURS_PER_ROUND = DAYS_PER_YEAR * 24


def _lcoe(facility_id: FacilityId) -> float:
    """Lifetime cost per MWh without the carbon tax: wind and solar at their normal output, the rest at full output.
    ``scripts/workshop_lcoe.py`` works out the same, with hydro and the tax too.
    """
    facility = CATALOG[facility_id]
    match facility.category:
        case FacilityCategory.WIND:
            capacity_factor = statistics.fmean(NORMAL_OUTPUT[season].wind for season in SEASONS)
        case FacilityCategory.PV | FacilityCategory.CSP:
            capacity_factor = statistics.fmean(NORMAL_OUTPUT[season].solar for season in SEASONS)
        case _:
            capacity_factor = 1.0
    rounds = facility.lifetime_rounds
    mwh = facility.base_power_generation / 1e6 * HOURS_PER_ROUND * capacity_factor * rounds
    om_share = facility.om_fixed_share + (1 - facility.om_fixed_share) * capacity_factor
    fuel = FUEL_USE[facility_id] * CATALOG_FUEL_PRICES[facility.fuel_type] if facility.fuel_type else 0.0
    return (facility.base_price + facility.om_per_round * om_share * rounds) / mwh + fuel


def _om_per_mw(facility_id: FacilityId) -> float:
    facility = CATALOG[facility_id]
    return facility.om_per_round / (facility.base_power_generation / 1e6)


def _running_cost(facility: FacilityId, *, carbon_tax: bool) -> float:
    """Fuel, and the carbon tax if it is on, per MWh generated."""
    fuel_type = CATALOG[facility].fuel_type
    assert fuel_type is not None
    tax = CARBON_TAX_RATE * CATALOG[facility].base_pollution if carbon_tax else 0.0
    return FUEL_USE[facility] * CATALOG_FUEL_PRICES[fuel_type] + tax


def test_solar_comes_to_about_30_per_mwh() -> None:
    for facility in (FacilityId.PV_SOLAR, FacilityId.MULTI_LAYER_PV, FacilityId.CSP_SOLAR):
        assert 25 <= _lcoe(facility) <= 35, facility


def test_onshore_wind_comes_to_40_to_45_per_mwh_and_offshore_to_less() -> None:
    onshore = _lcoe(FacilityId.ONSHORE_WIND_TURBINE)
    assert 40 <= onshore <= 45
    assert _lcoe(FacilityId.OFFSHORE_WIND_TURBINE) < onshore


def test_fossil_plants_come_to_50_to_80_per_mwh_without_the_carbon_tax() -> None:
    for facility in CATALOG.values():
        if facility.fuel_type in (Fuel.COAL, Fuel.GAS):
            assert 50 <= _lcoe(facility.id) <= 80, facility.id


def test_an_upgrade_costs_less_per_mwh_than_its_base_tier() -> None:
    for base, upgrade in UPGRADES.items():
        if CATALOG[base].base_storage_capacity is None:
            assert _lcoe(upgrade) < _lcoe(base), upgrade


def test_a_nuclear_reactor_needs_the_loan_in_round_one() -> None:
    for round_count in range(1, 8):
        price = session_price(FacilityId.NUCLEAR_REACTOR, round_count)
        assert WORKSHOP_STARTING_BUDGET < price <= WORKSHOP_STARTING_BUDGET + LOAN_AMOUNT, round_count


def test_nuclear_and_dams_cost_less_in_short_sessions() -> None:
    millions = {
        facility: [session_price(facility, round_count) / 1e6 for round_count in (2, 3, 4, 5, 6)]
        for facility in SESSION_LENGTH_PRICES
    }
    assert millions == {
        FacilityId.NUCLEAR_REACTOR: [53, 53, 60, 70, 70],
        FacilityId.NUCLEAR_REACTOR_GEN4: [83, 83, 95, 110, 110],
        FacilityId.SMALL_WATER_DAM: [22, 22, 25, 25, 25],
        FacilityId.LARGE_WATER_DAM: [54, 54, 60, 60, 60],
    }


def test_other_facilities_cost_their_catalog_price_whatever_the_session_length() -> None:
    for facility in CATALOG.values():
        if facility.id not in SESSION_LENGTH_PRICES:
            assert session_price(facility.id, 3) == facility.base_price, facility.id


def test_small_dams_can_reach_the_large_dam_unlock() -> None:
    small_dam = CATALOG[FacilityId.SMALL_WATER_DAM]
    assert small_dam.max_owned is not None
    players = 6
    assert players * small_dam.max_owned * small_dam.base_price >= unlock_threshold(players)


def test_o_and_m_per_mw_goes_coal_nuclear_gas_wind() -> None:
    # #1227 first put wind between coal and gas. Cutting wind's O&M to bring its LCOE down put it below gas. #1306
    # shrank the coal burner, which put its O&M per MW above nuclear's.
    nuclear = _om_per_mw(FacilityId.NUCLEAR_REACTOR)
    coal = _om_per_mw(FacilityId.COAL_BURNER)
    gas = _om_per_mw(FacilityId.GAS_BURNER)
    wind = _om_per_mw(FacilityId.ONSHORE_WIND_TURBINE)
    assert coal > nuclear > gas > wind


def test_pv_has_the_lowest_o_and_m_per_mw_and_hydro_less_than_nuclear_and_coal() -> None:
    others = [
        facility.id
        for facility in CATALOG.values()
        if facility.base_storage_capacity is None and facility.category != FacilityCategory.PV
    ]
    assert _om_per_mw(FacilityId.PV_SOLAR) < min(_om_per_mw(facility) for facility in others)
    for facility in (FacilityId.SMALL_WATER_DAM, FacilityId.LARGE_WATER_DAM):
        assert _om_per_mw(facility) < min(_om_per_mw(FacilityId.NUCLEAR_REACTOR), _om_per_mw(FacilityId.COAL_BURNER))


def test_an_upgrade_has_no_more_o_and_m_per_mw_than_its_base_tier() -> None:
    # #1306 raised PV's power more than multi-layer PV's, which left multi-layer PV 2% above it.
    for base, upgrade in UPGRADES.items():
        if CATALOG[base].base_storage_capacity is None:
            assert _om_per_mw(upgrade) < 1.05 * _om_per_mw(base), upgrade


def test_gas_costs_more_than_coal_to_run_until_the_carbon_tax() -> None:
    # With the tax, the gas burner comes within 5% of the coal burner, and the combined cycle below the modern coal
    # plant.
    pairs = [
        (FacilityId.GAS_BURNER, FacilityId.COAL_BURNER, 1.05),
        (FacilityId.COMBINED_CYCLE, FacilityId.MODERN_COAL_PLANT, 1.0),
    ]
    for gas, coal, margin in pairs:
        assert _running_cost(gas, carbon_tax=False) > _running_cost(coal, carbon_tax=False)
        assert _running_cost(gas, carbon_tax=True) < margin * _running_cost(coal, carbon_tax=True)
