"""The relations between Workshop's facility values that the first recalibration set (#1227)."""

from __future__ import annotations

from energetica.workshop.facilities import CATALOG, FacilityId, WorkshopFacility
from energetica.workshop.fuel import CATALOG_FUEL_PRICES, FUEL_USE
from energetica.workshop.loan import LOAN_AMOUNT
from energetica.workshop.player import WORKSHOP_STARTING_BUDGET
from energetica.workshop.unlocks import UPGRADES, unlock_threshold
from energetica.workshop.votes import CARBON_TAX_RATE

# From cheapest to most expensive per MW per Round of lifetime.
COST_ORDER = [
    FacilityId.MODERN_COAL_PLANT,
    FacilityId.COMBINED_CYCLE,
    FacilityId.CSP_SOLAR,
    FacilityId.COAL_BURNER,
    FacilityId.GAS_BURNER,
    FacilityId.NUCLEAR_REACTOR_GEN4,
    FacilityId.NUCLEAR_REACTOR,
    FacilityId.LARGE_WATER_DAM,
    FacilityId.MULTI_LAYER_PV,
    FacilityId.SMALL_WATER_DAM,
    FacilityId.PV_SOLAR,
    FacilityId.OFFSHORE_WIND_TURBINE,
    FacilityId.ONSHORE_WIND_TURBINE,
]


def _cost_per_mw_round(facility: WorkshopFacility) -> float:
    return facility.base_price / (facility.base_power_generation / 1e6) / facility.lifetime_rounds


def _om_per_mw(facility_id: FacilityId) -> float:
    facility = CATALOG[facility_id]
    return facility.om_per_round / (facility.base_power_generation / 1e6)


def _running_cost(facility: FacilityId, *, carbon_tax: bool) -> float:
    """Fuel, and the carbon tax if it is on, per MWh generated."""
    fuel_type = CATALOG[facility].fuel_type
    assert fuel_type is not None
    tax = CARBON_TAX_RATE * CATALOG[facility].base_pollution if carbon_tax else 0.0
    return FUEL_USE[facility] * CATALOG_FUEL_PRICES[fuel_type] + tax


def test_generators_follow_the_cost_order() -> None:
    costs = [_cost_per_mw_round(CATALOG[facility]) for facility in COST_ORDER]
    assert costs == sorted(costs)
    assert len(set(costs)) == len(costs)


def test_the_cost_order_covers_every_generator() -> None:
    generators = {facility.id for facility in CATALOG.values() if facility.base_storage_capacity is None}
    assert set(COST_ORDER) == generators


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
