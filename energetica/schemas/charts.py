"""Schemas for chart data APIs."""

from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, Field

from energetica.enums import ExtractionFacilityType, FunctionalFacilityType, PowerFacilityType, StorageFacilityType

SeriesKeyType = TypeVar("SeriesKeyType")

PowerSourcesKey = PowerFacilityType | StorageFacilityType | Literal["imports"]
PowerSinksKey = (
    Literal["industry", "construction", "research", "transport", "exports", "dumping"]
    | StorageFacilityType
    | ExtractionFacilityType
    | FunctionalFacilityType
)


class ChartDataResponse(BaseModel, Generic[SeriesKeyType]):
    """
    Generic response model for time series chart data.

    Contains time series data for various categories over a specified time range.
    """

    start_tick: int = Field(description="The starting tick (timestamp) of the data series")
    count: int = Field(description="Number of data points in the series")
    resolution: Literal["1", "6", "36", "216", "1296"] = Field(
        description="Time resolution between data points in ticks",
    )
    series: dict[SeriesKeyType, list[float]] = Field(
        description="Time series data indexed by category, with power values in MW",
    )


class PowerSourcesResponse(ChartDataResponse[PowerSourcesKey]):
    """
    Response model for power sources chart data.

    Contains time series power generation and import data for different facility types over a specified time range.
    """

    series: dict[PowerSourcesKey, list[float]] = Field(
        description="Time series data for each facility type and imports, with power values in MW",
    )


class PowerSinksResponse(ChartDataResponse[PowerSinksKey]):
    """
    Response model for power sinks chart data.

    Contains time series power demand data by category over a specified time range.
    Categories include standard demands (industry, construction, research, transport, exports, dumping)
    plus dynamically added facility-type categories (storage, extraction, functional).
    """

    series: dict[PowerSinksKey, list[float]] = Field(
        description="Time series power demand data by category, with power values in MW",
    )
