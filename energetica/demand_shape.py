"""Interpolate a demand curve's intra-day and seasonal shape onto the game's tick grid.

Pure: takes the two shape arrays and the current tick position, returns a factor.
Player-agnostic and consumer-agnostic — a caller feeds it whatever curve applies
(currently the whole national consumption curve; nothing here assumes industry).

Both arrays can be any length and are resampled onto the caller's own grid: the
intra-day array is treated as one sample per ``len(intraday)``-th of a day (using
``ticks_per_day``), the seasonal array as one sample per ``len(seasonal)``-th of a
year (using ``days_per_year``), so a caller can supply a curve at its own native
resolution without pre-binning it to match another curve's grid.
"""

from __future__ import annotations

from typing import Sequence


def demand_shape_factor(
    intraday: Sequence[float],
    seasonal: Sequence[float],
    ticks_per_day: float,
    days_per_year: float,
    real_t: float,
) -> float:
    """Combined intra-day x seasonal factor at tick ``real_t``.

    ``real_t`` is a tick count from the epoch (so day 0 starts at real-time midnight).
    ``days_per_year`` is the length of one full seasonal cycle, in days.
    """
    day = round(real_t // ticks_per_day)
    intra_day_t = real_t % ticks_per_day

    year_t = (day % days_per_year) + intra_day_t / ticks_per_day
    seasonal_len = len(seasonal)
    seasonal_pos = year_t * seasonal_len / days_per_year
    s0 = int(seasonal_pos) % seasonal_len
    s1 = (s0 + 1) % seasonal_len
    frac = seasonal_pos - int(seasonal_pos)
    seasonal_factor = seasonal[s0] * (1 - frac) + seasonal[s1] * frac

    intraday_len = len(intraday)
    intra_day_factor = intraday[round(intra_day_t * intraday_len / ticks_per_day) % intraday_len]

    return intra_day_factor * seasonal_factor
