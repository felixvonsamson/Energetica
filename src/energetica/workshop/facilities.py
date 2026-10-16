"""Workshop's own facility catalog (#998): the fixed values of every facility a player can buy.

Workshop authors its facilities itself (#975) and never reads the persistent world's
``config/assets.py``. Fuels are Workshop's own list too, not the persistent world's ``Fuel`` enum
(#1049). The fields follow #977, plus ``om_fixed_share`` (#992).

This module holds only each facility's values. Which facilities a session offers is not a property
of a facility but of the session, so it lives in :mod:`energetica.workshop.unlocks`.

Units follow the persistent world: power in W, energy in Wh, emissions in kg, time in in-game
seconds, money in the game's currency. Lifetime and construction lag are counted in Rounds.

The first recalibration (#1227) set every price, ``om_per_round``, power, storage capacity and generator
lifetime, all rounded. The values aim at a levelized cost of electricity (LCOE, everything a facility
costs over its lifetime divided by the energy it generates) of about 40 per MWh for solar, 50 to 55 for
onshore wind and at least 25% less for offshore, 40 to 50 for hydro and 25 to 40 for nuclear. Fossil
plants come to 40 to 70 without the carbon tax and 90 to 135 with it. ``scripts/workshop_lcoe.py`` works these out. A nuclear reactor costs
more than the starting budget, so buying one in Round 1 takes the loan. O&M is about 10% to 20% of what
a facility earns in the bot test sessions. The other values are copied from the persistent world or
invented, and every value is still open to the game-balance pass (#1145).
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class Fuel(StrEnum):
    """A fuel that a Workshop facility burns."""

    COAL = "coal"
    GAS = "gas"
    URANIUM = "uranium"


class FacilityCategory(StrEnum):
    """The groups of #975. A base tier and its upgrade share one."""

    WIND = "wind"
    CONVENTIONAL = "conventional"
    HYDRO = "hydro"
    NUCLEAR = "nuclear"
    PV = "pv"
    CSP = "csp"
    BATTERIES = "batteries"
    HYDROGEN_STORAGE = "hydrogen_storage"
    PUMPED_HYDRO = "pumped_hydro"


class FacilityId(StrEnum):
    """Every facility in the Workshop catalog."""

    ONSHORE_WIND_TURBINE = "onshore_wind_turbine"
    OFFSHORE_WIND_TURBINE = "offshore_wind_turbine"
    COAL_BURNER = "coal_burner"
    MODERN_COAL_PLANT = "modern_coal_plant"
    GAS_BURNER = "gas_burner"
    COMBINED_CYCLE = "combined_cycle"
    SMALL_WATER_DAM = "small_water_dam"
    LARGE_WATER_DAM = "large_water_dam"
    NUCLEAR_REACTOR = "nuclear_reactor"
    NUCLEAR_REACTOR_GEN4 = "nuclear_reactor_gen4"
    PV_SOLAR = "pv_solar"
    MULTI_LAYER_PV = "multi_layer_pv"
    CSP_SOLAR = "csp_solar"
    LITHIUM_ION_BATTERIES = "lithium_ion_batteries"
    SOLID_STATE_BATTERIES = "solid_state_batteries"
    HYDROGEN_STORAGE = "hydrogen_storage"
    PUMPED_HYDRO = "pumped_hydro"


class WorkshopFacility(BaseModel):
    """One facility's fixed values."""

    model_config = ConfigDict(frozen=True)

    id: FacilityId
    name: str
    category: FacilityCategory
    base_price: float = Field(description="Price to build one")
    base_power_generation: float = Field(
        description="Maximum power output in W. For storage, the power it charges and discharges at"
    )
    base_storage_capacity: float | None = Field(description="Energy it stores, in Wh. Null if it is not storage")
    base_efficiency: float | None = Field(
        description="Share of stored energy it gives back, from 0 to 1. Null if it is not storage"
    )
    construction_lag_rounds: int = Field(description="Rounds after the one it is built in before it works")
    lifetime_rounds: int = Field(description="Rounds it works for before it retires")
    om_per_round: float = Field(description="Operation and maintenance cost per Round at full use")
    om_fixed_share: float = Field(description="Share of the O&M cost charged whatever the facility's use, from 0 to 1")
    base_construction_pollution: float = Field(description="CO₂ emitted to build one, in kg")
    base_pollution: float = Field(description="CO₂ emitted per MWh generated, in kg")
    ramping_time: float = Field(description="In-game seconds to go from no output to full output")
    fuel_type: Fuel | None = Field(description="The fuel it burns, or null if it burns none")
    max_owned: int | None = Field(
        description="The most a player can own at once, counting those under construction and those in their "
        "selection. Null if there is no limit",
    )


def _generator(
    id: FacilityId,
    name: str,
    category: FacilityCategory,
    *,
    price: float,
    power: float,
    construction_lag: int,
    lifetime: int,
    om_per_round: float,
    om_fixed_share: float,
    construction_pollution: float,
    pollution: float,
    ramping_time: float,
    fuel: Fuel | None,
    max_owned: int | None = None,
) -> WorkshopFacility:
    return WorkshopFacility(
        id=id,
        name=name,
        category=category,
        base_price=price,
        base_power_generation=power,
        base_storage_capacity=None,
        base_efficiency=None,
        construction_lag_rounds=construction_lag,
        lifetime_rounds=lifetime,
        om_per_round=om_per_round,
        om_fixed_share=om_fixed_share,
        base_construction_pollution=construction_pollution,
        base_pollution=pollution,
        ramping_time=ramping_time,
        fuel_type=fuel,
        max_owned=max_owned,
    )


def _storage(
    id: FacilityId,
    name: str,
    category: FacilityCategory,
    *,
    price: float,
    power: float,
    capacity: float,
    efficiency: float,
    lifetime: int,
    om_per_round: float,
    construction_pollution: float,
    ramping_time: float,
) -> WorkshopFacility:
    return WorkshopFacility(
        id=id,
        name=name,
        category=category,
        base_price=price,
        base_power_generation=power,
        base_storage_capacity=capacity,
        base_efficiency=efficiency,
        construction_lag_rounds=0,
        lifetime_rounds=lifetime,
        om_per_round=om_per_round,
        om_fixed_share=1.0,
        base_construction_pollution=construction_pollution,
        base_pollution=0,
        ramping_time=ramping_time,
        fuel_type=None,
        max_owned=None,
    )


# Each player can own only a few of each dam (#1223), so hydro cannot cover a room's demand on its own.
_MAX_DAMS = 3

# Construction lags are the #975 table. Since #1227, hydro and nuclear last 6 Rounds, fossil plants and CSP 3, and
# wind and PV 2, so renewables last about as long as fossil plants, as they do in reality. The fixed shares of O&M start from the
# persistent world's: 1.0 for renewables and storage, 0.5 for nuclear, 0.2 for other controllable
# facilities (#992).
_FACILITIES = [
    _generator(
        FacilityId.ONSHORE_WIND_TURBINE, "Onshore wind turbine", FacilityCategory.WIND,
        price=18_000_000, power=50_000_000, construction_lag=0, lifetime=2, om_per_round=1_500_000, om_fixed_share=1.0,
        construction_pollution=420_000, pollution=0, ramping_time=0, fuel=None,
    ),
    _generator(
        FacilityId.OFFSHORE_WIND_TURBINE, "Offshore wind turbine", FacilityCategory.WIND,
        price=25_000_000, power=100_000_000, construction_lag=0, lifetime=2, om_per_round=2_000_000, om_fixed_share=1.0,
        construction_pollution=4_900_000, pollution=0, ramping_time=0, fuel=None,
    ),
    _generator(
        FacilityId.COAL_BURNER, "Coal burner", FacilityCategory.CONVENTIONAL,
        price=9_000_000, power=60_000_000, construction_lag=0, lifetime=3, om_per_round=4_500_000, om_fixed_share=0.2,
        construction_pollution=1_100_000, pollution=1_664, ramping_time=7_200, fuel=Fuel.COAL,
    ),
    _generator(
        FacilityId.MODERN_COAL_PLANT, "Modern coal power plant", FacilityCategory.CONVENTIONAL,
        price=13_000_000, power=100_000_000, construction_lag=0, lifetime=3, om_per_round=6_500_000, om_fixed_share=0.2,
        construction_pollution=2_500_000, pollution=1_100, ramping_time=5_400, fuel=Fuel.COAL,
    ),
    _generator(
        FacilityId.GAS_BURNER, "Gas burner", FacilityCategory.CONVENTIONAL,
        price=8_000_000, power=50_000_000, construction_lag=0, lifetime=3, om_per_round=2_500_000, om_fixed_share=0.2,
        construction_pollution=657_000, pollution=1_006, ramping_time=480, fuel=Fuel.GAS,
    ),
    _generator(
        FacilityId.COMBINED_CYCLE, "Combined cycle", FacilityCategory.CONVENTIONAL,
        price=11_000_000, power=80_000_000, construction_lag=0, lifetime=3, om_per_round=3_500_000, om_fixed_share=0.2,
        construction_pollution=1_500_000, pollution=797, ramping_time=4_500, fuel=Fuel.GAS,
    ),
    _generator(
        FacilityId.SMALL_WATER_DAM, "Small water dam", FacilityCategory.HYDRO,
        price=45_000_000, power=40_000_000, construction_lag=0, lifetime=6, om_per_round=2_000_000, om_fixed_share=1.0,
        construction_pollution=1_500_000, pollution=0, ramping_time=0, fuel=None,
        max_owned=_MAX_DAMS,
    ),
    _generator(
        FacilityId.LARGE_WATER_DAM, "Large water dam", FacilityCategory.HYDRO,
        price=110_000_000, power=120_000_000, construction_lag=0, lifetime=6, om_per_round=5_000_000, om_fixed_share=1.0,
        construction_pollution=8_000_000, pollution=0, ramping_time=0, fuel=None,
        max_owned=_MAX_DAMS,
    ),
    _generator(
        FacilityId.NUCLEAR_REACTOR, "Nuclear reactor", FacilityCategory.NUCLEAR,
        price=80_000_000, power=100_000_000, construction_lag=1, lifetime=6, om_per_round=13_000_000, om_fixed_share=0.5,
        construction_pollution=6_800_000, pollution=2, ramping_time=46_800, fuel=Fuel.URANIUM,
    ),
    _generator(
        FacilityId.NUCLEAR_REACTOR_GEN4, "Gen-IV nuclear reactor", FacilityCategory.NUCLEAR,
        price=130_000_000, power=190_000_000, construction_lag=1, lifetime=6, om_per_round=23_000_000, om_fixed_share=0.5,
        construction_pollution=12_000_000, pollution=3, ramping_time=30_000, fuel=Fuel.URANIUM,
    ),
    _generator(
        FacilityId.PV_SOLAR, "PV solar", FacilityCategory.PV,
        price=5_000_000, power=60_000_000, construction_lag=0, lifetime=2, om_per_round=100_000, om_fixed_share=1.0,
        construction_pollution=12_000_000, pollution=0, ramping_time=0, fuel=None,
    ),
    _generator(
        FacilityId.MULTI_LAYER_PV, "Multi-layer PV", FacilityCategory.PV,
        price=7_500_000, power=100_000_000, construction_lag=0, lifetime=2, om_per_round=150_000, om_fixed_share=1.0,
        construction_pollution=14_000_000, pollution=0, ramping_time=0, fuel=None,
    ),
    _generator(
        FacilityId.CSP_SOLAR, "Concentrated solar power", FacilityCategory.CSP,
        price=5_000_000, power=45_000_000, construction_lag=0, lifetime=3, om_per_round=250_000, om_fixed_share=1.0,
        construction_pollution=1_260_000, pollution=0, ramping_time=0, fuel=None,
    ),
    # Batteries shift energy within a day (#1202): lithium-ion holds about three hours at full power and
    # solid-state five.
    _storage(
        FacilityId.LITHIUM_ION_BATTERIES, "Lithium-ion batteries", FacilityCategory.BATTERIES,
        price=3_000_000, power=30_000_000, capacity=100_000_000, efficiency=0.69, lifetime=1, om_per_round=150_000,
        construction_pollution=8_000_000, ramping_time=180,
    ),
    _storage(
        FacilityId.SOLID_STATE_BATTERIES, "Solid-state batteries", FacilityCategory.BATTERIES,
        price=6_000_000, power=50_000_000, capacity=250_000_000, efficiency=0.79, lifetime=1, om_per_round=250_000,
        construction_pollution=6_000_000, ramping_time=180,
    ),
    _storage(
        FacilityId.HYDROGEN_STORAGE, "Hydrogen storage", FacilityCategory.HYDROGEN_STORAGE,
        price=10_000_000, power=20_000_000, capacity=5_000_000_000, efficiency=0.33, lifetime=3, om_per_round=400_000,
        construction_pollution=2_400_000, ramping_time=480,
    ),
    # Between the persistent world's small and large pumped hydro, which Workshop does not split.
    _storage(
        FacilityId.PUMPED_HYDRO, "Pumped hydro", FacilityCategory.PUMPED_HYDRO,
        price=30_000_000, power=60_000_000, capacity=4_000_000_000, efficiency=0.78, lifetime=6, om_per_round=1_000_000,
        construction_pollution=1_200_000, ramping_time=720,
    ),
]  # fmt: skip

CATALOG: dict[FacilityId, WorkshopFacility] = {facility.id: facility for facility in _FACILITIES}
"""Every Workshop facility, in display order: each base tier followed by its upgrade."""
