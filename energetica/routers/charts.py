"""
Routes for chart data APIs.

This module provides endpoints for retrieving historical time-series data at multiple
resolution levels. Data is stored in a multi-resolution structure combining:
  - Rolling history buffers: Recent data in circular buffers (216 ticks at finest granularity)
  - Pickle files: Persisted historical data aggregated into 5 resolution levels (360 datapoints for each)
  - Resolution levels are 1, 6, 36, 216, and 1296 ticks - a geometric series scaling by 6

Key Constraints:
  - Rolling history is updated every tick with latest data, operates on 216-tick circular buffers
  - Rolling history is persisted to pickle files every 216 ticks
  - Recall: ticks are zero indexed
  - When referring to a datapoint a 1-1 resolution, the tick number is sufficient
  - When referring to non 1-1 resolutions, use multiples of 6 / 36 / 216 / 1296
"""

from collections import defaultdict
from pathlib import Path
import pickle
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
import numpy as np

from energetica.database.network import Network
from energetica.database.player import Player
from energetica.globals import engine
from energetica.schemas.charts import (
    ClimateDataResponse,
    EmissionsResponse,
    MarketCurveData,
    MarketDataResponse,
    NetworkConsumptionResponse,
    NetworkDataResponse,
    NetworkExportsResponse,
    NetworkGenerationResponse,
    NetworkImportsResponse,
    OpCostsResponse,
    PowerSinksResponse,
    PowerSourcesResponse,
    ResourcesResponse,
    RevenuesResponse,
    StorageLevelResponse,
    TemperatureDataResponse,
)
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/charts", tags=["Charts"])

Resolution = Literal["1", "6", "36", "216", "1296"]
PickleChartKey = Literal["revenues", "op_costs", "generation", "demand", "storage", "resources", "emissions"]
ClimatePickleKey = Literal["emissions", "temperature"]
PickleNetworkKey = Literal["network_data", "exports", "imports", "generation", "consumption"]


def _load_pickle_data(
    file_path: str,
) -> dict[PickleChartKey | ClimatePickleKey | PickleNetworkKey, dict[str, list[list[float]]]]:
    """Load persisted historical data from pickle file."""
    if not Path(file_path).is_file():
        return defaultdict(lambda: defaultdict(list))
    try:
        with open(file_path, "rb") as file:
            return pickle.load(file)
    except Exception:
        # Return empty structure if pickle is corrupted
        return defaultdict(lambda: defaultdict(list))


def _get_time_series_data(
    start_tick: int,
    count: int,
    resolution: Resolution,
    pickle_path: str,
    rolling_history_data: dict[str, list],
    data_category: PickleChartKey | ClimatePickleKey | PickleNetworkKey,
) -> dict:
    """
    Generic function to extract time series data from pickle files and rolling history.

    This is the core implementation used by both player-specific and server-wide data endpoints.

    Args:
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
        resolution: Aggregation level ("1", "6", "36", "216", "1296")
        pickle_path: Path to the pickle file containing historical data
        rolling_history_data: Dictionary of rolling history data by series key
        data_category: Category key to extract from pickle data

    Returns:
        Dictionary with start_tick, count, and series data

    Raises:
        HTTPException 400: If start_tick is misaligned, in future, or beyond available data
    """
    window_size = {
        "1": 1,
        "6": 6,
        "36": 36,
        "216": 216,
        "1296": 1296,
    }[resolution]

    # Validate start_tick is aligned to resolution
    if start_tick % window_size != 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"start_tick must be aligned to resolution. For resolution {resolution}, start_tick must be a multiple of {window_size}",
        )

    current_tick = engine.total_t

    # Validate start_tick is not in the future
    if start_tick >= current_tick:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"start_tick ({start_tick}) must be less than current tick ({current_tick})",
        )

    # Validate start_tick is not too old for this resolution
    max_datapoints = 360
    max_ticks_at_resolution = max_datapoints * window_size
    oldest_valid_tick = max(0, (current_tick // window_size - max_datapoints) * window_size)

    if start_tick < oldest_valid_tick:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requested start_tick ({start_tick}) is too old for resolution {resolution}. Maximum lookback: {max_ticks_at_resolution} ticks (360 datapoints). Oldest valid tick: {oldest_valid_tick}",
        )

    # Validate that not too many datapoints are being requested
    available_datapoints = (current_tick - start_tick) // window_size

    if count > available_datapoints:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requested number of datapoint ({count}) after tick {start_tick} is more than {available_datapoints}, the number of available datapoints.",
        )

    # Load pickle data
    pickle_data = _load_pickle_data(pickle_path)

    resolution_index = {
        "1": 0,
        "6": 1,
        "36": 2,
        "216": 3,
        "1296": 4,
    }[resolution]

    # Calculate the boundary between pickle and rolling history
    fresh_rolling_history_tick_count = current_tick % 216
    rolling_start_tick = current_tick - fresh_rolling_history_tick_count
    pickle_start_tick = rolling_start_tick - max_datapoints * window_size
    request_end_tick = start_tick + count * window_size

    def get_pickle_datapoints(series_key: str) -> list[float]:
        """Extract requested datapoints from pickle data."""
        if start_tick >= rolling_start_tick:
            return []

        pickle_data_end_tick = min(request_end_tick, rolling_start_tick)
        pickle_start_offset = (start_tick - pickle_start_tick) // window_size
        pickle_end_offset = (pickle_data_end_tick - pickle_start_tick) // window_size

        if series_key in pickle_data[data_category]:
            series_data = pickle_data[data_category][series_key][resolution_index]
            actual_start = min(pickle_start_offset, len(series_data))
            actual_end = min(pickle_end_offset, len(series_data))
            result = series_data[actual_start:actual_end]
            if len(result) < (pickle_end_offset - pickle_start_offset):
                result = [0.0] * (pickle_end_offset - pickle_start_offset - len(result)) + result
            return result
        else:
            return [0.0] * (pickle_end_offset - pickle_start_offset)

    def get_rolling_datapoints(rolling_series: list) -> list[float]:
        """Extract and aggregate requested datapoints from rolling history."""
        if request_end_tick <= rolling_start_tick:
            return []

        rolling_data_start_tick = max(start_tick, rolling_start_tick)
        rolling_data_end_tick = min(request_end_tick, current_tick)

        rolling_start_offset = rolling_data_start_tick - rolling_start_tick
        rolling_end_offset = rolling_data_end_tick - rolling_start_tick

        ticks = rolling_series[rolling_start_offset:rolling_end_offset]

        if len(ticks) == 0:
            return []

        num_complete_windows = len(ticks) // window_size
        if num_complete_windows == 0:
            return []

        complete_ticks = ticks[: num_complete_windows * window_size]
        aggregated = np.array(complete_ticks).reshape(-1, window_size).mean(axis=1)
        return aggregated.tolist()

    # Build the response by combining pickle and rolling history data
    # Convert keys to strings to ensure compatibility with all response schemas
    datapoints = {
        str(series_key): [*get_pickle_datapoints(str(series_key)), *get_rolling_datapoints(rolling_series)]
        for series_key, rolling_series in rolling_history_data.items()
    }

    return {
        "start_tick": start_tick,
        "count": count,
        "series": datapoints,
    }


def _get_chart_data(
    player: Player,
    start_tick: int,
    count: int,
    data_category: PickleChartKey,
    resolution: Resolution,
) -> dict:
    """
    Extract player-specific chart data for a time range at the requested resolution.

    Args:
        player: Player whose data to retrieve
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
        data_category: Category to extract (e.g., "generation", "demand")
        resolution: Aggregation level ("1", "6", "36", "216", "1296")

    Raises:
        HTTPException 400: If start_tick is misaligned, in future, or beyond available data
    """
    current_tick = engine.total_t
    fresh_rolling_history_tick_count = current_tick % 216
    pickle_path = f"instance/data/players/player_{player.id}.pck"
    rolling_history_data = player.rolling_history.get_data(t=fresh_rolling_history_tick_count)[data_category]

    return _get_time_series_data(
        start_tick=start_tick,
        count=count,
        resolution=resolution,
        pickle_path=pickle_path,
        rolling_history_data=rolling_history_data,
        data_category=data_category,
    )


def _get_climate_data(
    start_tick: int,
    count: int,
    data_category: ClimatePickleKey,
    resolution: Resolution,
) -> dict:
    """
    Extract server-wide climate data for a time range at the requested resolution.

    Args:
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
        data_category: Category to extract ("emissions" for CO2, "temperature" for temp data)
        resolution: Aggregation level ("1", "6", "36", "216", "1296")

    Raises:
        HTTPException 400: If start_tick is misaligned, in future, or beyond available data
    """
    current_tick = engine.total_t
    fresh_rolling_history_tick_count = current_tick % 216
    pickle_path = "instance/data/servers/climate_data.pck"

    # Check if climate data file exists
    if not Path(pickle_path).is_file():
        return {
            "start_tick": start_tick,
            "count": count,
            "series": {},
        }

    rolling_history_data = engine.current_climate_data.get_data(t=fresh_rolling_history_tick_count)[data_category]

    return _get_time_series_data(
        start_tick=start_tick,
        count=count,
        resolution=resolution,
        pickle_path=pickle_path,
        rolling_history_data=rolling_history_data,
        data_category=data_category,
    )


def _get_network_data(
    network_id: int,
    start_tick: int,
    count: int,
    data_category: PickleNetworkKey,
    resolution: Resolution,
) -> dict:
    """
    Extract network-specific chart data for a time range at the requested resolution.

    Args:
        network_id: ID of the network whose data to retrieve
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
        data_category: Category to extract (e.g., "network_data", "exports", "imports")
        resolution: Aggregation level ("1", "6", "36", "216", "1296")

    Raises:
        HTTPException 403: If network not found
        HTTPException 400: If start_tick is misaligned, in future, or beyond available data
    """
    network = Network.getitem(
        network_id,
        error=HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Network not found"),
    )

    current_tick = engine.total_t
    fresh_rolling_history_tick_count = current_tick % 216
    pickle_path = f"instance/data/networks/{network.id}/network_data.pck"
    rolling_history_data = network.rolling_history.get_data(t=fresh_rolling_history_tick_count)[data_category]

    return _get_time_series_data(
        start_tick=start_tick,
        count=count,
        resolution=resolution,
        pickle_path=pickle_path,
        rolling_history_data=rolling_history_data,
        data_category=data_category,
    )


@router.get("/power-sources/{resolution}")
def get_power_sources(
    player: Annotated[Player, Depends(get_settled_player)],
    resolution: Resolution,
    start_tick: int,
    count: int,
) -> PowerSourcesResponse:
    """
    Get power generation time series by facility type and imports at the specified resolution.

    Parameters:
        resolution: Aggregation level (1/6/36/216/1296 ticks per datapoint)
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
    """
    data = _get_chart_data(player, start_tick, count, "generation", resolution)
    return PowerSourcesResponse(resolution=resolution, **data)


@router.get("/power-sinks/{resolution}")
def get_power_sinks(
    player: Annotated[Player, Depends(get_settled_player)],
    resolution: Resolution,
    start_tick: int,
    count: int,
) -> PowerSinksResponse:
    """
    Get power demand time series by category at the specified resolution.

    Parameters:
        resolution: Aggregation level (1/6/36/216/1296 ticks per datapoint)
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
    """
    data = _get_chart_data(player, start_tick, count, "demand", resolution)
    return PowerSinksResponse(resolution=resolution, **data)


@router.get("/storage-level/{resolution}")
def get_storage_level(
    player: Annotated[Player, Depends(get_settled_player)],
    resolution: Resolution,
    start_tick: int,
    count: int,
) -> StorageLevelResponse:
    """
    Get storage level time series by facility type at the specified resolution.

    Parameters:
        resolution: Aggregation level (1/6/36/216/1296 ticks per datapoint)
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
    """
    data = _get_chart_data(player, start_tick, count, "storage", resolution)
    return StorageLevelResponse(resolution=resolution, **data)


@router.get("/revenues/{resolution}")
def get_revenues(
    player: Annotated[Player, Depends(get_settled_player)],
    resolution: Resolution,
    start_tick: int,
    count: int,
) -> RevenuesResponse:
    """
    Get revenues time series by revenue type at the specified resolution.

    Parameters:
        resolution: Aggregation level (1/6/36/216/1296 ticks per datapoint)
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
    """
    data = _get_chart_data(player, start_tick, count, "revenues", resolution)
    return RevenuesResponse(resolution=resolution, **data)


@router.get("/op-costs/{resolution}")
def get_op_costs(
    player: Annotated[Player, Depends(get_settled_player)],
    resolution: Resolution,
    start_tick: int,
    count: int,
) -> OpCostsResponse:
    """
    Get operating costs time series by facility type at the specified resolution.

    Parameters:
        resolution: Aggregation level (1/6/36/216/1296 ticks per datapoint)
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
    """
    data = _get_chart_data(player, start_tick, count, "op_costs", resolution)
    return OpCostsResponse(resolution=resolution, **data)


@router.get("/emissions/{resolution}")
def get_emissions(
    player: Annotated[Player, Depends(get_settled_player)],
    resolution: Resolution,
    start_tick: int,
    count: int,
) -> EmissionsResponse:
    """
    Get CO2 emissions time series by source at the specified resolution.

    Parameters:
        resolution: Aggregation level (1/6/36/216/1296 ticks per datapoint)
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
    """
    data = _get_chart_data(player, start_tick, count, "emissions", resolution)
    return EmissionsResponse(resolution=resolution, **data)


@router.get("/climate/{resolution}")
def get_climate_data(
    _player: Annotated[Player, Depends(get_settled_player)],
    resolution: Resolution,
    start_tick: int,
    count: int,
) -> ClimateDataResponse:
    """
    Get global atmospheric CO2 levels time series at the specified resolution.

    This is server-wide data affected by all players, not player-specific.

    Parameters:
        resolution: Aggregation level (1/6/36/216/1296 ticks per datapoint)
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
    """
    data = _get_climate_data(start_tick, count, "emissions", resolution)
    return ClimateDataResponse(resolution=resolution, **data)


@router.get("/temperature/{resolution}")
def get_temperature_data(
    _player: Annotated[Player, Depends(get_settled_player)],
    resolution: Resolution,
    start_tick: int,
    count: int,
) -> TemperatureDataResponse:
    """
    Get global temperature time series at the specified resolution.

    This is server-wide data affected by all players, not player-specific.

    Parameters:
        resolution: Aggregation level (1/6/36/216/1296 ticks per datapoint)
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
    """
    data = _get_climate_data(start_tick, count, "temperature", resolution)
    return TemperatureDataResponse(resolution=resolution, **data)


@router.get("/resources/{resolution}")
def get_resources(
    player: Annotated[Player, Depends(get_settled_player)],
    resolution: Resolution,
    start_tick: int,
    count: int,
) -> ResourcesResponse:
    """
    Get resource stocks time series at the specified resolution.

    Parameters:
        resolution: Aggregation level (1/6/36/216/1296 ticks per datapoint)
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
    """
    data = _get_chart_data(player, start_tick, count, "resources", resolution)
    return ResourcesResponse(resolution=resolution, **data)


@router.get("/networks/{network_id}/network_data/{resolution}")
def get_network_data(
    _player: Annotated[Player, Depends(get_settled_player)],
    network_id: int,
    resolution: Resolution,
    start_tick: int,
    count: int,
) -> NetworkDataResponse:
    """
    Get network price and quantity time series at the specified resolution.

    This is network-specific data showing market clearing price and quantity.

    Parameters:
        network_id: ID of the network
        resolution: Aggregation level (1/6/36/216/1296 ticks per datapoint)
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
    """
    data = _get_network_data(network_id, start_tick, count, "network_data", resolution)
    return NetworkDataResponse(resolution=resolution, **data)


@router.get("/networks/{network_id}/exports/{resolution}")
def get_network_exports(
    _player: Annotated[Player, Depends(get_settled_player)],
    network_id: int,
    resolution: Resolution,
    start_tick: int,
    count: int,
) -> NetworkExportsResponse:
    """
    Get network exports by player time series at the specified resolution.

    This is network-specific data showing power exported by each player.

    Parameters:
        network_id: ID of the network
        resolution: Aggregation level (1/6/36/216/1296 ticks per datapoint)
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
    """
    data = _get_network_data(network_id, start_tick, count, "exports", resolution)
    return NetworkExportsResponse(resolution=resolution, **data)


@router.get("/networks/{network_id}/imports/{resolution}")
def get_network_imports(
    _player: Annotated[Player, Depends(get_settled_player)],
    network_id: int,
    resolution: Resolution,
    start_tick: int,
    count: int,
) -> NetworkImportsResponse:
    """
    Get network imports by player time series at the specified resolution.

    This is network-specific data showing power imported by each player.

    Parameters:
        network_id: ID of the network
        resolution: Aggregation level (1/6/36/216/1296 ticks per datapoint)
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
    """
    data = _get_network_data(network_id, start_tick, count, "imports", resolution)
    return NetworkImportsResponse(resolution=resolution, **data)


@router.get("/networks/{network_id}/generation/{resolution}")
def get_network_generation(
    _player: Annotated[Player, Depends(get_settled_player)],
    network_id: int,
    resolution: Resolution,
    start_tick: int,
    count: int,
) -> NetworkGenerationResponse:
    """
    Get network generation by facility type time series at the specified resolution.

    This is network-specific data showing total generation by facility type across all network members.

    Parameters:
        network_id: ID of the network
        resolution: Aggregation level (1/6/36/216/1296 ticks per datapoint)
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
    """
    data = _get_network_data(network_id, start_tick, count, "generation", resolution)
    return NetworkGenerationResponse(resolution=resolution, **data)


@router.get("/networks/{network_id}/consumption/{resolution}")
def get_network_consumption(
    _player: Annotated[Player, Depends(get_settled_player)],
    network_id: int,
    resolution: Resolution,
    start_tick: int,
    count: int,
) -> NetworkConsumptionResponse:
    """
    Get network consumption by type time series at the specified resolution.

    This is network-specific data showing total consumption by type across all network members.

    Parameters:
        network_id: ID of the network
        resolution: Aggregation level (1/6/36/216/1296 ticks per datapoint)
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
    """
    data = _get_network_data(network_id, start_tick, count, "consumption", resolution)
    return NetworkConsumptionResponse(resolution=resolution, **data)


@router.get("/networks/{network_id}/market/{tick}")
def get_market_data(
    player: Annotated[Player, Depends(get_settled_player)],
    network_id: int,
    tick: int,
) -> MarketDataResponse:
    """
    Get market supply/demand curve data for a specific historical tick.

    This endpoint returns the complete market state including supply and demand curves,
    player imports/exports, generation, consumption, and market clearing price/quantity.

    Parameters:
        network_id: ID of the network
        tick: Absolute tick number to retrieve market data for
    """
    # Verify the network exists
    network = Network.getitem(
        network_id,
        error=HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Network not found"),
    )

    # Validate tick is not in the future
    current_tick = engine.total_t
    if tick >= current_tick:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requested tick ({tick}) must be less than current tick ({current_tick})",
        )

    # Load market data from pickle file
    market_file_path = Path(f"instance/data/networks/{network_id}/charts/market_t{tick}.pck")
    if not market_file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Market data not found for tick {tick}",
        )

    try:
        with open(market_file_path, "rb") as file:
            market_data = pickle.load(file)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load market data: {str(e)}",
        )

    # Convert DataFrames to dict format
    capacities_dict = market_data["capacities"].to_dict(orient="list")
    demands_dict = market_data["demands"].to_dict(orient="list")

    return MarketDataResponse(
        tick=tick,
        capacities=MarketCurveData(**capacities_dict),
        demands=MarketCurveData(**demands_dict),
        market_price=market_data["market_price"],
        market_quantity=market_data["market_quantity"],
    )
