"""Interpolate a demand curve's intra-day and seasonal shape onto the game's tick grid.

Pure: takes the two shape arrays and the current tick position, returns a factor.
Player-agnostic and consumer-agnostic — a caller feeds it whatever curve applies
(currently the whole national consumption curve; nothing here assumes industry).

Both arrays can be any length: the intra-day array is treated as one sample per
``len(intraday)``-th of a day, the seasonal array as one sample per
``len(seasonal)``-th of a year, so a caller can supply a curve at its own native
resolution without pre-binning it to match another curve's grid.
"""

from __future__ import annotations

from typing import Sequence


def demand_shape_factor(
    intraday: Sequence[float],
    seasonal: Sequence[float],
    ticks_per_day: float,
    real_t: float,
) -> float:
    """Combined intra-day x seasonal factor at tick ``real_t``.

    ``real_t`` is a tick count from the epoch (so day 0 starts at real-time midnight).
    """
    day = round(real_t // ticks_per_day)
    intra_day_t = real_t % ticks_per_day

    seasonal_len = len(seasonal)
    sf1 = seasonal[day % seasonal_len]
    sf2 = seasonal[(day + 1) % seasonal_len]
    seasonal_factor = (sf1 * (ticks_per_day - intra_day_t) + sf2 * intra_day_t) / ticks_per_day

    intraday_len = len(intraday)
    intra_day_factor = intraday[round(intra_day_t * intraday_len / ticks_per_day)]

    return intra_day_factor * seasonal_factor
