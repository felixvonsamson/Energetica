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
from energetica.schemas.charts import PowerSinksResponse, PowerSourcesResponse
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
    Extract chart data for a specific time range at the requested resolution.

    Algorithm:
      1. Validate start_tick alignment and bounds (not future, not beyond 360-datapoint limit)
      2. Load pickle data and merge with rolling history buffer (fetching valid circular buffer data)
      3. Extract the resolution-specific array (contains up to 360 datapoints)
      4. Map start_tick to array index (arrays end at current_tick, grow backward)
      5. Slice the array to return exactly the requested time range

    Args:
        player: Player whose data to retrieve
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve (will be clamped to available data)
        data_category: Category to extract (e.g., "generation", "demand")
        resolution: Aggregation level ("1", "6", "36", "216", "1296")

    Returns:
        Dict containing start_tick, actual count returned (in datapoints), and series data

    Raises:
        HTTPException 400: If start_tick is misaligned, in future, or beyond 360-datapoint limit
        HTTPException 500: If data structure inconsistency detected
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
    relevant_rolling_tick_count = fresh_rolling_history_tick_count - (fresh_rolling_history_tick_count % window_size)
    relevant_pickle_datapoint_count = (count * window_size - relevant_rolling_tick_count) // window_size

    resolution_index = {
        "1": 0,
        "6": 1,
        "36": 2,
        "216": 3,
        "1296": 4,
    }[resolution]

    def pickle_datapoints(series_key: str) -> list[float]:
        if series_key in pickle_data[data_category]:
            return pickle_data[data_category][series_key][resolution_index][-relevant_pickle_datapoint_count:]
        else:
            return [0] * relevant_pickle_datapoint_count

    def rolling_datapoints(rolling_series: list) -> list[float]:
        return np.array(rolling_series[:relevant_rolling_tick_count]).reshape(-1, window_size).mean(axis=1)

    datapoints = {
        series_key: [*pickle_datapoints(series_key), *rolling_datapoints(rolling_series)]
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
    Get power generation time series by facility type and imports.

    Returns historical power generation data aggregated at the specified resolution.
    Each facility type (e.g., coal_burner, PV_solar) and imports are returned as
    separate series with aligned timestamps.

    Query Parameters:
        resolution: Aggregation level (1/6/36/216/1296 ticks per datapoint)
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve (ticks covered = count × window_size)

    Constraints:
        - start_tick must be a multiple of resolution window size
        - Maximum lookback: 360 datapoints (360 × window_size ticks)
        - count is clamped to available datapoints
        - start_tick must be < current_tick
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
    Get power demand time series by category.

    Returns historical power consumption data aggregated at the specified resolution.
    Demand is broken down by category with aligned timestamps.

    Query Parameters:
        resolution: Aggregation level (1/6/36/216/1296 ticks per datapoint)
        start_tick: First tick to include (must be aligned to resolution)
        count: Number of datapoints to retrieve (ticks covered = count × window_size)

    Constraints:
        - start_tick must be a multiple of resolution window size
        - Maximum lookback: 360 datapoints (360 × window_size ticks)
        - count is clamped to available datapoints
        - start_tick must be < current_tick
    """
    data = _get_chart_data(player, start_tick, count, "demand", resolution)
    return PowerSinksResponse(resolution=resolution, **data)
