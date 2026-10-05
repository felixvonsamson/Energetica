"""Workshop's own facility catalog (#998): the fixed values of every facility a player can buy.

Workshop authors its facilities itself (#975) and never reads the persistent world's
``config/assets.py``. Fuels are Workshop's own list too, not the persistent world's ``Fuel`` enum
(#1049). The fields follow #977, plus ``om_fixed_share`` (#992).

This module holds only each facility's values. Which facilities a session offers is not a property
of a facility but of the session, so it lives in :mod:`energetica.workshop.unlocks`.

Units follow the persistent world: power in W, energy in Wh, emissions in kg, time in in-game
seconds, money in the game's currency. Lifetime and construction lag are counted in Rounds.

Every value is a placeholder until the game-balance pass (#1145). Most are copied from the
persistent world. The modern coal power plant, Multi-layer PV and the unsplit pumped hydro have no
persistent-world counterpart, so their values are invented, as is every ``om_per_round``.
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


def _generator(
    id: FacilityId,
    name: str,
    category: FacilityCategory,
    *,
    price: float,
    power: float,
    lag: int,
    lifetime: int,
    om: float,
    om_fixed_share: float,
    construction_pollution: float,
    pollution: float,
    ramping_time: float,
    fuel: Fuel | None,
) -> WorkshopFacility:
    return WorkshopFacility(
        id=id,
        name=name,
        category=category,
        base_price=price,
        base_power_generation=power,
        base_storage_capacity=None,
        base_efficiency=None,
        construction_lag_rounds=lag,
        lifetime_rounds=lifetime,
        om_per_round=om,
        om_fixed_share=om_fixed_share,
        base_construction_pollution=construction_pollution,
        base_pollution=pollution,
        ramping_time=ramping_time,
        fuel_type=fuel,
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
    om: float,
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
        om_per_round=om,
        om_fixed_share=1.0,
        base_construction_pollution=construction_pollution,
        base_pollution=0,
        ramping_time=ramping_time,
        fuel_type=None,
    )


_F = FacilityId
_C = FacilityCategory

# Lifetimes and construction lags are the #975 table. The fixed shares of O&M start from the
# persistent world's: 1.0 for renewables and storage, 0.5 for nuclear, 0.2 for other controllable
# facilities (#992).
_FACILITIES = [
    _generator(
        _F.ONSHORE_WIND_TURBINE, "Onshore wind turbine", _C.WIND,
        price=270_000, power=11_000_000, lag=0, lifetime=2, om=15_000, om_fixed_share=1.0,
        construction_pollution=420_000, pollution=0, ramping_time=0, fuel=None,
    ),
    _generator(
        _F.OFFSHORE_WIND_TURBINE, "Offshore wind turbine", _C.WIND,
        price=2_000_000, power=130_000_000, lag=0, lifetime=2, om=120_000, om_fixed_share=1.0,
        construction_pollution=4_900_000, pollution=0, ramping_time=0, fuel=None,
    ),
    _generator(
        _F.COAL_BURNER, "Coal burner", _C.CONVENTIONAL,
        price=105_000, power=21_000_000, lag=0, lifetime=4, om=18_000, om_fixed_share=0.2,
        construction_pollution=1_100_000, pollution=1_664, ramping_time=7_200, fuel=Fuel.COAL,
    ),
    _generator(
        _F.MODERN_COAL_PLANT, "Modern coal power plant", _C.CONVENTIONAL,
        price=260_000, power=60_000_000, lag=0, lifetime=4, om=35_000, om_fixed_share=0.2,
        construction_pollution=2_500_000, pollution=1_100, ramping_time=5_400, fuel=Fuel.COAL,
    ),
    _generator(
        _F.GAS_BURNER, "Gas burner", _C.CONVENTIONAL,
        price=90_000, power=11_000_000, lag=0, lifetime=4, om=16_000, om_fixed_share=0.2,
        construction_pollution=657_000, pollution=1_006, ramping_time=480, fuel=Fuel.GAS,
    ),
    _generator(
        _F.COMBINED_CYCLE, "Combined cycle", _C.CONVENTIONAL,
        price=310_000, power=54_000_000, lag=0, lifetime=4, om=30_000, om_fixed_share=0.2,
        construction_pollution=1_500_000, pollution=797, ramping_time=4_500, fuel=Fuel.GAS,
    ),
    _generator(
        _F.SMALL_WATER_DAM, "Small water dam", _C.HYDRO,
        price=65_000, power=14_000_000, lag=0, lifetime=8, om=4_000, om_fixed_share=1.0,
        construction_pollution=876_000, pollution=0, ramping_time=0, fuel=None,
    ),
    _generator(
        _F.LARGE_WATER_DAM, "Large water dam", _C.HYDRO,
        price=520_000, power=210_000_000, lag=0, lifetime=8, om=25_000, om_fixed_share=1.0,
        construction_pollution=8_760_000, pollution=0, ramping_time=0, fuel=None,
    ),
    _generator(
        _F.NUCLEAR_REACTOR, "Nuclear reactor", _C.NUCLEAR,
        price=840_000, power=167_000_000, lag=1, lifetime=8, om=110_000, om_fixed_share=0.5,
        construction_pollution=6_800_000, pollution=2, ramping_time=46_800, fuel=Fuel.URANIUM,
    ),
    _generator(
        _F.NUCLEAR_REACTOR_GEN4, "Gen-IV nuclear reactor", _C.NUCLEAR,
        price=1_800_000, power=335_000_000, lag=1, lifetime=8, om=200_000, om_fixed_share=0.5,
        construction_pollution=12_000_000, pollution=3, ramping_time=30_000, fuel=Fuel.URANIUM,
    ),
    _generator(
        _F.PV_SOLAR, "PV solar", _C.PV,
        price=900_000, power=59_000_000, lag=0, lifetime=1, om=25_000, om_fixed_share=1.0,
        construction_pollution=12_000_000, pollution=0, ramping_time=0, fuel=None,
    ),
    _generator(
        _F.MULTI_LAYER_PV, "Multi-layer PV", _C.PV,
        price=1_200_000, power=95_000_000, lag=0, lifetime=1, om=30_000, om_fixed_share=1.0,
        construction_pollution=14_000_000, pollution=0, ramping_time=0, fuel=None,
    ),
    _generator(
        _F.CSP_SOLAR, "Concentrated solar power", _C.CSP,
        price=123_000, power=38_000_000, lag=0, lifetime=4, om=20_000, om_fixed_share=1.0,
        construction_pollution=1_260_000, pollution=0, ramping_time=0, fuel=None,
    ),
    _storage(
        _F.LITHIUM_ION_BATTERIES, "Lithium-ion batteries", _C.BATTERIES,
        price=660_000, power=86_000_000, capacity=3_200_000_000, efficiency=0.69, lifetime=1, om=8_000,
        construction_pollution=8_000_000, ramping_time=180,
    ),
    _storage(
        _F.SOLID_STATE_BATTERIES, "Solid-state batteries", _C.BATTERIES,
        price=1_000_000, power=107_000_000, capacity=5_000_000_000, efficiency=0.79, lifetime=1, om=9_000,
        construction_pollution=6_000_000, ramping_time=180,
    ),
    _storage(
        _F.HYDROGEN_STORAGE, "Hydrogen storage", _C.HYDROGEN_STORAGE,
        price=420_000, power=90_000_000, capacity=30_000_000_000, efficiency=0.33, lifetime=3, om=20_000,
        construction_pollution=2_400_000, ramping_time=480,
    ),
    # Between the persistent world's small and large pumped hydro, which Workshop does not split.
    _storage(
        _F.PUMPED_HYDRO, "Pumped hydro", _C.PUMPED_HYDRO,
        price=120_000, power=60_000_000, capacity=4_000_000_000, efficiency=0.78, lifetime=6, om=10_000,
        construction_pollution=1_200_000, ramping_time=720,
    ),
]  # fmt: skip

CATALOG: dict[FacilityId, WorkshopFacility] = {facility.id: facility for facility in _FACILITIES}
"""Every Workshop facility, in display order: each base tier followed by its upgrade."""
