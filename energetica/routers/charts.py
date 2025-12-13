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

from energetica.database.player import Player
from energetica.globals import engine
from energetica.schemas.charts import (
    OpCostsResponse,
    PowerSinksResponse,
    PowerSourcesResponse,
    RevenuesResponse,
    StorageLevelResponse,
)
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/charts", tags=["Charts"])

Resolution = Literal["1", "6", "36", "216", "1296"]
PickleChartKey = Literal["revenues", "op_costs", "generation", "demand", "storage", "resources", "emissions"]


def _load_pickle_data(file_path: str) -> dict[PickleChartKey, dict[str, list[list[float]]]]:
    """Load persisted historical data from pickle file."""
    if not Path(file_path).is_file():
        return defaultdict(lambda: defaultdict(list))
    try:
        with open(file_path, "rb") as file:
            return pickle.load(file)
    except Exception:
        # Return empty structure if pickle is corrupted
        return defaultdict(lambda: defaultdict(list))


def _get_chart_data(
    player: Player,
    start_tick: int,
    count: int,
    data_category: PickleChartKey,
    resolution: Resolution,
) -> dict:
    """
    Extract chart data for a time range at the requested resolution.

    Validates alignment and bounds, then merges persisted pickle data with rolling history.

    Args:
        player: Player whose data to retrieve
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve
        data_category: Category to extract (e.g., "generation", "demand")
        resolution: Aggregation level ("1", "6", "36", "216", "1296")

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
    # Data structure stores 360 datapoints per resolution level (in pickle + rolling history)
    # Maximum lookback = 360 datapoints × window_size

    max_datapoints = 360
    max_ticks_at_resolution = max_datapoints * window_size
    oldest_valid_tick = max(0, current_tick - max_ticks_at_resolution)

    if start_tick < oldest_valid_tick:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requested start_tick ({start_tick}) is too old for resolution {resolution}. Maximum lookback: {max_ticks_at_resolution} ticks (360 datapoints). Oldest valid tick: {oldest_valid_tick}",
        )

    # Validate that not too many datapoints are being requested. Note that for a datapoint to be considered valid and
    # returned by the API, it must be an total average, not a partial average, i.e. averaging 4 datapoints is not ok
    # when requesting a resolution of 6. This ensures the whatever data this API returns can be safely cached and will
    # not change.
    available_datapoints = (current_tick - start_tick) // window_size

    if count > available_datapoints:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requested number of datapoint ({count}) after tick {start_tick} is more than {available_datapoints}, the number of available datapoints.",
        )

    # Load pickle data and merge with rolling history
    pickle_path = f"instance/data/players/player_{player.id}.pck"
    pickle_data = _load_pickle_data(pickle_path)

    # Get current rolling history data, 216-tick.
    # Pass t parameter to get only the relevant portion of the buffer.
    fresh_rolling_history_tick_count = current_tick % 216
    rolling_history = player.rolling_history.get_data(t=fresh_rolling_history_tick_count)[data_category]

    resolution_index = {
        "1": 0,
        "6": 1,
        "36": 2,
        "216": 3,
        "1296": 4,
    }[resolution]

    # Calculate the boundary between pickle and rolling history
    # Rolling history contains the most recent fresh_rolling_history_tick_count ticks
    rolling_start_tick = current_tick - fresh_rolling_history_tick_count

    # Pickle contains up to 360 datapoints ending just before rolling history starts
    # Note: pickle_start_tick can be negative if game hasn't run long enough
    pickle_start_tick = rolling_start_tick - max_datapoints * window_size

    # Calculate which ticks are requested
    request_end_tick = start_tick + count * window_size

    def get_pickle_datapoints(series_key: str) -> list[float]:
        """Extract requested datapoints from pickle data."""
        if start_tick >= rolling_start_tick:
            # All requested data is in rolling history, none from pickle
            return []

        # Calculate which part of the request falls within pickle range
        pickle_data_end_tick = min(request_end_tick, rolling_start_tick)

        # Calculate the indices within the pickle array
        # pickle[0] represents ticks [pickle_start_tick, pickle_start_tick + window_size)
        # pickle[i] represents ticks [pickle_start_tick + i*window_size, pickle_start_tick + (i+1)*window_size)
        pickle_start_offset = (start_tick - pickle_start_tick) // window_size
        pickle_end_offset = (pickle_data_end_tick - pickle_start_tick) // window_size

        # Extract from pickle or return zeros
        if series_key in pickle_data[data_category]:
            series_data = pickle_data[data_category][series_key][resolution_index]
            # Handle case where pickle might have fewer datapoints than expected
            actual_start = min(pickle_start_offset, len(series_data))
            actual_end = min(pickle_end_offset, len(series_data))
            result = series_data[actual_start:actual_end]
            # Pad with zeros if we don't have enough data
            if len(result) < (pickle_end_offset - pickle_start_offset):
                result = [0.0] * (pickle_end_offset - pickle_start_offset - len(result)) + result
            return result
        else:
            return [0.0] * (pickle_end_offset - pickle_start_offset)

    def get_rolling_datapoints(rolling_series: list) -> list[float]:
        """Extract and aggregate requested datapoints from rolling history."""
        if request_end_tick <= rolling_start_tick:
            # All requested data is in pickle, none from rolling history
            return []

        # Calculate which part of the request falls within rolling history range
        rolling_data_start_tick = max(start_tick, rolling_start_tick)
        rolling_data_end_tick = min(request_end_tick, current_tick)

        # Calculate the tick indices within rolling history buffer
        # rolling_series[0] represents tick rolling_start_tick
        # rolling_series[i] represents tick rolling_start_tick + i
        rolling_start_offset = rolling_data_start_tick - rolling_start_tick
        rolling_end_offset = rolling_data_end_tick - rolling_start_tick

        # Extract the ticks
        ticks = rolling_series[rolling_start_offset:rolling_end_offset]

        if len(ticks) == 0:
            return []

        # Aggregate ticks into datapoints of window_size
        # We only want complete windows
        num_complete_windows = len(ticks) // window_size
        if num_complete_windows == 0:
            return []

        complete_ticks = ticks[: num_complete_windows * window_size]
        aggregated = np.array(complete_ticks).reshape(-1, window_size).mean(axis=1)
        return aggregated.tolist()

    # Build the response by combining pickle and rolling history data
    datapoints = {
        series_key: [*get_pickle_datapoints(series_key), *get_rolling_datapoints(rolling_series)]
        for series_key, rolling_series in rolling_history.items()
    }

    return {
        "start_tick": start_tick,
        "count": count,
        "series": datapoints,
    }


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
