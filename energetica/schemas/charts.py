"""Schemas for chart data APIs."""

from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, Field

from energetica.enums import (
    ControllableFacilityType,
    ExtractionFacilityType,
    FunctionalFacilityType,
    HydroFacilityType,
    SolarFacilityType,
    StorageFacilityType,
    WindFacilityType,
)

SeriesKeyType = TypeVar("SeriesKeyType")

PowerSourcesKey = (
    WindFacilityType
    | HydroFacilityType
    | SolarFacilityType
    | ControllableFacilityType
    | StorageFacilityType
    | Literal["imports"]
)
PowerSinksKey = (
    Literal["industry", "construction", "research", "transport", "exports", "dumping"]
    | StorageFacilityType
    | ExtractionFacilityType
    | FunctionalFacilityType
)
RevenuesKey = Literal["industry", "exports", "imports", "dumping", "climate_events"]

OpCostsKey = (
    Literal[
        # Storage facilities
        "small_pumped_hydro",
        "large_pumped_hydro",
        "lithium_ion_batteries",
        "solid_state_batteries",
        "molten_salt",
        "hydrogen_storage",
        # Renewable facilities
        "watermill",
        "small_water_dam",
        "large_water_dam",
        "windmill",
        "onshore_wind_turbine",
        "offshore_wind_turbine",
        "CSP_solar",
        "PV_solar",
        # Controllable facilities
        "nuclear_reactor",
        "nuclear_reactor_gen4",
        "steam_engine",
        "coal_burner",
        "gas_burner",
        "combined_cycle",
        # Extraction facilities
        "coal_mine",
        "gas_drilling_site",
        "uranium_mine",
    ]
)


class ChartDataResponse(BaseModel, Generic[SeriesKeyType]):
    """Generic response model for time series chart data."""

    start_tick: int = Field(description="The starting tick (timestamp) of the data series")
    count: int = Field(description="Number of data points in the series")
    resolution: Literal["1", "6", "36", "216", "1296"] = Field(
        description="Time resolution between data points in ticks",
    )
    series: dict[SeriesKeyType, list[float]] = Field(
        description="Time series data indexed by category, with power values in MW",
    )


class PowerSourcesResponse(ChartDataResponse[PowerSourcesKey]):
    """Response model for power generation and import time series."""

    series: dict[PowerSourcesKey, list[float]] = Field(
        description="Time series data for each facility type and imports, with power values in MW",
    )


class PowerSinksResponse(ChartDataResponse[PowerSinksKey]):
    """Response model for power demand time series."""

    series: dict[PowerSinksKey, list[float]] = Field(
        description="Time series power demand data by category, with power values in MW",
    )


class StorageLevelResponse(ChartDataResponse[StorageFacilityType]):
    """Response model for storage level time series."""

    series: dict[StorageFacilityType, list[float]] = Field(
        description="Time series data for each storage facility type, with energy values in MWh",
    )


class RevenuesResponse(ChartDataResponse[RevenuesKey]):
    """Response model for revenue time series."""

    series: dict[RevenuesKey, list[float]] = Field(
        description="Time series data for each revenue type, with currency values",
    )


class OpCostsResponse(ChartDataResponse[OpCostsKey]):
    """Response model for operating costs time series."""

    series: dict[OpCostsKey, list[float]] = Field(
        description="Time series data for each facility type's operating and maintenance costs, with currency values",
    )
