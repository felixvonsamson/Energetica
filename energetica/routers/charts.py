"""Routes for chart data APIs."""

from collections import defaultdict
from pathlib import Path
import pickle
from typing import Annotated, Literal

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, status

from energetica.database.player import Player
from energetica.globals import engine
from energetica.schemas.charts import PowerSinksResponse, PowerSourcesResponse
from energetica.utils.auth import get_settled_player
from energetica.utils.misc import reduce_resolution

router = APIRouter(prefix="/charts", tags=["Charts"])

Resolution = Literal["1", "6", "36", "216", "1296"]

# Resolution values mapped to their averaging window sizes
RESOLUTION_WINDOWS = {
    "1": 1,
    "6": 6,
    "36": 36,
    "216": 216,
    "1296": 1296,
}


def _load_pickle_data(file_path: str) -> dict:
    """Load pickle data from file, returning empty structure if file doesn't exist."""
    if not Path(file_path).is_file():
        return defaultdict(lambda: defaultdict(list))
    try:
        with open(file_path, "rb") as file:
            return pickle.load(file)
    except Exception:
        # Return empty structure if pickle is corrupted
        return defaultdict(lambda: defaultdict(list))


def _merge_pickle_with_rolling_history(
    pickle_data: dict,
    rolling_data: dict,
) -> dict:
    """Merge pickle file data with current rolling history data using reduce_resolution."""
    merged_data = pickle_data

    for category in rolling_data:
        if category not in merged_data:
            merged_data[category] = {}

        for element in rolling_data[category]:
            new_el_data = rolling_data[category][element]

            if element not in merged_data[category]:
                # Initialize new element with default structure
                merged_data[category][element] = [[0.0] * 360 for _ in range(5)]

            merged_el_data = merged_data[category][element]
            reduce_resolution(merged_el_data, np.array(new_el_data))

    return merged_data


def _extract_series_by_resolution(
    merged_data: dict,
    category: str,
    resolution: Resolution,
) -> dict[str, list[float]]:
    """Extract time series from merged data at the specified resolution level."""
    resolution_index = {
        "1": 0,
        "6": 1,
        "36": 2,
        "216": 3,
        "1296": 4,
    }[resolution]

    category_data = merged_data.get(category, {})
    series = {}

    for element, resolution_arrays in category_data.items():
        if isinstance(resolution_arrays, list) and len(resolution_arrays) > resolution_index:
            series[element] = [float(v) for v in resolution_arrays[resolution_index]]
        else:
            # Handle case where data structure is unexpected
            series[element] = []

    return series


def _get_chart_data(
    player: Player,
    start_tick: int,
    count: int,
    data_category: str,
    resolution: Resolution,
) -> dict:
    """
    Extract chart data from combined pickle and rolling history sources.

    Supports arbitrary historical ranges by loading pickle files and merging with current rolling history.
    """
    window_size = RESOLUTION_WINDOWS[resolution]

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

    # Ensure count doesn't exceed available data and is a multiple of resolution
    available_ticks = current_tick - start_tick
    # Round down to nearest multiple of window_size to ensure complete data points
    available_ticks = (available_ticks // window_size) * window_size
    actual_count = min(count, available_ticks)

    # Load pickle data and merge with rolling history
    pickle_path = f"instance/data/players/player_{player.id}.pck"
    pickle_data = _load_pickle_data(pickle_path)

    # Get current rolling history data
    rolling_history = player.rolling_history.get_data()

    # Merge pickle with rolling history
    merged_data = _merge_pickle_with_rolling_history(pickle_data, rolling_history)

    # Extract series at the requested resolution
    series = _extract_series_by_resolution(merged_data, data_category, resolution)

    # Slice the data to the requested range
    # The merged data contains the most recent data, so we need to slice from the end
    sliced_series = {}
    for element, values in series.items():
        # Get the last actual_count values
        sliced_values = values[-actual_count:] if actual_count > 0 else []
        sliced_series[element] = sliced_values

    return {
        "start_tick": start_tick,
        "count": len(sliced_series.get(list(sliced_series.keys())[0], [])) if sliced_series else 0,
        "series": sliced_series,
    }


@router.get("/power-sources/{resolution}")
def get_power_sources(
    player: Annotated[Player, Depends(get_settled_player)],
    resolution: Resolution,
    start_tick: int,
    count: int,
) -> PowerSourcesResponse:
    """
    Get power sources data for all facility types and imports.

    Returns time series power generation and import data for the specified time range and resolution.
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
    Get power sinks data for demand by category.

    Returns time series power demand data for the specified time range and resolution.
    """
    data = _get_chart_data(player, start_tick, count, "demand", resolution)
    return PowerSinksResponse(resolution=resolution, **data)
