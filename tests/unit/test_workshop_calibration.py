"""The relations between Workshop's facility values that the first recalibration set (#1227)."""

from __future__ import annotations

import statistics

from energetica.workshop.demand_block import DAYS_PER_YEAR
from energetica.workshop.facilities import CATALOG, FacilityCategory, FacilityId, Fuel
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


def test_solar_comes_to_about_40_per_mwh() -> None:
    for facility in (FacilityId.PV_SOLAR, FacilityId.MULTI_LAYER_PV, FacilityId.CSP_SOLAR):
        assert 35 <= _lcoe(facility) <= 45, facility


def test_wind_comes_to_50_to_55_per_mwh() -> None:
    for facility in (FacilityId.ONSHORE_WIND_TURBINE, FacilityId.OFFSHORE_WIND_TURBINE):
        assert 50 <= _lcoe(facility) <= 55, facility


def test_fossil_plants_come_to_40_to_70_per_mwh_without_the_carbon_tax() -> None:
    for facility in CATALOG.values():
        if facility.fuel_type in (Fuel.COAL, Fuel.GAS):
            assert 40 <= _lcoe(facility.id) <= 70, facility.id


def test_an_upgrade_costs_less_per_mwh_than_its_base_tier() -> None:
    for base, upgrade in UPGRADES.items():
        if CATALOG[base].base_storage_capacity is None:
            assert _lcoe(upgrade) < _lcoe(base), upgrade


def test_a_nuclear_reactor_needs_the_loan_in_round_one() -> None:
    price = CATALOG[FacilityId.NUCLEAR_REACTOR].base_price
    assert WORKSHOP_STARTING_BUDGET < price <= WORKSHOP_STARTING_BUDGET + LOAN_AMOUNT


def test_small_dams_can_reach_the_large_dam_unlock() -> None:
    small_dam = CATALOG[FacilityId.SMALL_WATER_DAM]
    assert small_dam.max_owned is not None
    players = 6
    assert players * small_dam.max_owned * small_dam.base_price >= unlock_threshold(players)


def test_o_and_m_per_mw_goes_nuclear_coal_wind_gas() -> None:
    nuclear = _om_per_mw(FacilityId.NUCLEAR_REACTOR)
    coal = _om_per_mw(FacilityId.COAL_BURNER)
    wind = _om_per_mw(FacilityId.ONSHORE_WIND_TURBINE)
    gas = _om_per_mw(FacilityId.GAS_BURNER)
    assert nuclear > coal > wind > gas


def test_pv_and_hydro_have_a_low_o_and_m_per_mw() -> None:
    lowest_other = min(
        _om_per_mw(facility)
        for facility in (FacilityId.NUCLEAR_REACTOR, FacilityId.COAL_BURNER, FacilityId.ONSHORE_WIND_TURBINE)
    )
    for facility in (FacilityId.PV_SOLAR, FacilityId.SMALL_WATER_DAM, FacilityId.LARGE_WATER_DAM):
        assert _om_per_mw(facility) < lowest_other


def test_an_upgrade_has_a_little_less_o_and_m_per_mw_than_its_base_tier() -> None:
    for base, upgrade in UPGRADES.items():
        if CATALOG[base].base_storage_capacity is None:
            assert _om_per_mw(upgrade) < _om_per_mw(base), upgrade


def test_gas_costs_more_than_coal_to_run_until_the_carbon_tax() -> None:
    pairs = [
        (FacilityId.GAS_BURNER, FacilityId.COAL_BURNER),
        (FacilityId.COMBINED_CYCLE, FacilityId.MODERN_COAL_PLANT),
    ]
    for gas, coal in pairs:
        assert _running_cost(gas, carbon_tax=False) > _running_cost(coal, carbon_tax=False)
        assert _running_cost(gas, carbon_tax=True) < _running_cost(coal, carbon_tax=True)
