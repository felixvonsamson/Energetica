"""Choose the days of a season that stand for all of it (#1164).

A representative day's result is scaled up to the whole season, so its weather counts many times over. The
middle day of the season is a single draw of the weather: if it happens to be calm, wind earns as if the whole
season had been calm. The matched formats instead look at the weather and demand of every day of the season
and choose the days whose average is closest to the season's:

- one *matched day*, the day closest to the season's average;
- three *matched days*. The season's days are sorted into three equal groups by wind (calm, middling,
  windy) and, separately, three by sunshine (dull, middling, sunny). The three days include one from each
  wind group and one from each sunshine group, such as a calm sunny day, a middling dull day and a windy
  middling day. This is a Latin square on the 3×3 grid of groups, which keeps wind and sunshine independent.

The chosen days are real days, so each keeps its own hourly ups and downs, and each counts equally. The season's
total still varies from one season to the next as much as the season's own weather does.

The functions here take each day's conditions and return which days to simulate. Working out the conditions is
the caller's job.
"""

from __future__ import annotations

import itertools
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

#: How many days :func:`matched_days` chooses.
MATCHED_DAY_COUNT = 3


@dataclass(frozen=True, slots=True)
class DayConditions:
    """What one day of the season was like, averaged over the day."""

    wind: float
    """The share of its power a wind turbine produced, from 0 to 1."""
    sun: float
    """The share of its power a solar panel produced, from 0 to 1."""
    demand: float
    """Demand, as a factor of the demand block's amplitude."""


def _conditions(days: Sequence[DayConditions]) -> np.ndarray:
    return np.array([(day.wind, day.sun, day.demand) for day in days])


def _relative_miss(conditions: np.ndarray, target: np.ndarray) -> np.ndarray:
    """How far each row of ``conditions`` is from ``target``: the sum of squared relative misses, so missing
    demand by 5% counts as much as missing wind by 5%.
    """
    return (((conditions - target) / np.maximum(target, 1e-9)) ** 2).sum(-1)


def matched_day(days: Sequence[DayConditions]) -> list[int]:
    """The index of the day whose conditions are closest to the average of ``days``."""
    conditions = _conditions(days)
    return [int(np.argmin(_relative_miss(conditions, conditions.mean(0))))]


def _thirds(values: np.ndarray) -> np.ndarray:
    """Which third of ``values`` each value falls in by rank: 0 for the lowest third, 1 or 2. Ranking keeps the
    thirds the same size even when values are tied.
    """
    ranks = np.empty(len(values), dtype=int)
    ranks[np.argsort(values, kind="stable")] = np.arange(len(values))
    return ranks * MATCHED_DAY_COUNT // len(values)


def matched_days(days: Sequence[DayConditions]) -> list[int]:
    """The indices, in order, of three of ``days``: one from each wind group and one from each sunshine group, the
    trio whose average conditions are closest to the average of ``days``.
    """
    conditions = _conditions(days)
    target = conditions.mean(0)
    wind_third, sun_third = _thirds(conditions[:, 0]), _thirds(conditions[:, 1])
    best: tuple[float, list[int]] | None = None
    # Each way of pairing the wind thirds with the sun thirds is one Latin square.
    for sun_of_wind in itertools.permutations(range(MATCHED_DAY_COUNT)):
        cells = [
            np.flatnonzero((wind_third == wind) & (sun_third == sun_of_wind[wind])) for wind in range(MATCHED_DAY_COUNT)
        ]
        if any(len(cell) == 0 for cell in cells):
            continue
        # Every combination of one day per cell, and how far its average misses the season's.
        combinations = np.array(list(itertools.product(*cells)))
        miss = _relative_miss(conditions[combinations].mean(1), target)
        index = int(np.argmin(miss))
        if best is None or miss[index] < best[0]:
            best = (float(miss[index]), sorted(int(day) for day in combinations[index]))
    if best is None:
        # No Latin square has a day in each of its cells, which takes very few days or very odd weather.
        raise ValueError(f"cannot choose {MATCHED_DAY_COUNT} matched days from {len(days)} days")
    return best[1]
