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
