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

OpCostsKey = Literal[
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

EmissionsKey = Literal[
    "carbon_capture",
    "steam_engine",
    "coal_burner",
    "gas_burner",
    "combined_cycle",
    "nuclear_reactor",
    "nuclear_reactor_gen4",
    "construction",
    "coal_mine",
    "gas_drilling_site",
    "uranium_mine",
]


class ChartDataResponse(BaseModel, Generic[SeriesKeyType]):
    """Generic response model for time series chart data."""

    start_tick: int = Field(description="The starting tick (timestamp) of the data series")
    count: int = Field(description="Number of data points in the series")
    resolution: Literal["1", "6", "36", "216", "1296"] = Field(
        description="Time resolution between data points in ticks",
    )
    series: dict[SeriesKeyType, list[float]] = Field(
        description="Time series data indexed by category",
    )


class PowerSourcesResponse(ChartDataResponse[PowerSourcesKey]):
    """Response model for power generation and import time series."""

    series: dict[PowerSourcesKey, list[float]] = Field(
        description="Time series data for each facility type and imports, with power values in W",
    )


class PowerSinksResponse(ChartDataResponse[PowerSinksKey]):
    """Response model for power demand time series."""

    series: dict[PowerSinksKey, list[float]] = Field(
        description="Time series power demand data by category, with power values in W",
    )


class StorageLevelResponse(ChartDataResponse[StorageFacilityType]):
    """Response model for storage level time series."""

    series: dict[StorageFacilityType, list[float]] = Field(
        description="Time series data for each storage facility type, with energy values in Wh",
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


class EmissionsResponse(ChartDataResponse[EmissionsKey]):
    """Response model for CO2 emissions time series."""

    series: dict[EmissionsKey, list[float]] = Field(
        description="Time series data for CO2 emissions by source, with mass values in kg",
    )


# Climate data responses (server-wide, not player-specific)
ClimateDataKey = Literal["CO2"]


class ClimateDataResponse(ChartDataResponse[ClimateDataKey]):
    """Response model for global climate data time series."""

    series: dict[ClimateDataKey, list[float]] = Field(
        description="Time series data for global CO2 levels in the atmosphere, with mass values in kg",
    )


TemperatureDataKey = Literal["deviation", "reference"]


class TemperatureDataResponse(ChartDataResponse[TemperatureDataKey]):
    """Response model for global temperature time series."""

    series: dict[TemperatureDataKey, list[float]] = Field(
        description="Time series data for global temperature, with deviation from reference in degrees C",
    )


ResourcesKey = Literal["coal", "gas", "uranium"]


class ResourcesResponse(ChartDataResponse[ResourcesKey]):
    """Response model for resource stocks time series."""

    series: dict[ResourcesKey, list[float]] = Field(
        description="Time series data for resource stocks, with quantities in tons",
    )


MoneyKey = Literal["balance"]


class MoneyResponse(ChartDataResponse[MoneyKey]):
    """Response model for player money balance time series."""

    series: dict[MoneyKey, list[float]] = Field(
        description="Time series data for player money balance, with currency values",
    )


# Market data responses (market-specific, not player-specific)
MarketDataKey = Literal["price", "quantity"]


class MarketClearingDataResponse(ChartDataResponse[MarketDataKey]):
    """Response model for market price and quantity time series."""

    series: dict[MarketDataKey, list[float]] = Field(
        description="Time series data for market price ($/MWh) and quantity (W)",
    )


class MarketExportsResponse(ChartDataResponse[str]):
    """Response model for market exports by player time series."""

    series: dict[str, list[float]] = Field(
        description="Time series data for exports by each player, with power values in W",
    )


class MarketImportsResponse(ChartDataResponse[str]):
    """Response model for market imports by player time series."""

    series: dict[str, list[float]] = Field(
        description="Time series data for imports by each player, with power values in W",
    )


MarketGenerationKey = PowerSourcesKey


class MarketGenerationResponse(ChartDataResponse[MarketGenerationKey]):
    """Response model for market generation by type time series."""

    series: dict[MarketGenerationKey, list[float]] = Field(
        description="Time series data for generation by each facility type in the market, with power values in W",
    )


MarketConsumptionKey = PowerSinksKey


class MarketConsumptionResponse(ChartDataResponse[MarketConsumptionKey]):
    """Response model for market consumption by type time series."""

    series: dict[MarketConsumptionKey, list[float]] = Field(
        description="Time series data for consumption by each type in the market, with power values in W",
    )


class MarketOrderData(BaseModel):
    """Model for market order data."""

    player_id: list[int] = Field(description="Player IDs for each order")
    capacity: list[float] = Field(description="Capacity values in W")
    price: list[float] = Field(description="Price values in $/MWh")
    facility: list[str] = Field(description="Facility type for each order")
    cumul_capacities: list[float] = Field(description="Cumulative capacity in W")


class MarketOrdersDataResponse(BaseModel):
    """Response model for market order data at a specific tick."""

    tick: int = Field(description="The tick (timestamp) for this market data snapshot")
    capacities: MarketOrderData = Field(description="Supply / sell / ask orders")
    demands: MarketOrderData = Field(description="Demand / bid orders")
    market_price: float = Field(description="Market clearing price in $/MWh")
    market_quantity: float = Field(description="Market clearing quantity in W")
