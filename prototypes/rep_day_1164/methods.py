"""Ways to compress a season into a few representative days, all with uniform weights (#1164).

A *plan* is a list of days to simulate. Each day is a list of sources, one per clearing: ``(year, season_day)``
says whose weather and demand that clearing gets. A whole real day uses one source for every clearing. A
stitched day changes source between segments.

Every method matches the season's mean (wind CF, PV CF, demand) as closely as it can, measured as relative
error, so a 5% miss on demand counts as much as a 5% miss on wind. They differ in where candidates come from and how many days are chosen.
"""

from __future__ import annotations

import itertools
from collections.abc import Callable

import numpy as np

from conditions import SeasonConditions, pv_share, wind_share

Source = tuple[int, int]
Plan = list[list[Source]]
Method = Callable[[SeasonConditions], Plan]

MIDDLE = 45


def _daily(c: SeasonConditions) -> np.ndarray:
    """Daily means, shape [year, season_day, feature], features (wind, pv, demand)."""
    return np.stack([c.wind.mean(2), c.pv.mean(2), c.demand.mean(2)], axis=-1)


def _target_and_scale(c: SeasonConditions) -> tuple[np.ndarray, np.ndarray]:
    target = _daily(c)[0].mean(0)
    return target, np.maximum(target, 1e-9)


def _whole(source: Source, clearings: int) -> list[Source]:
    return [source] * clearings


def middle_day(c: SeasonConditions) -> Plan:
    """Today's behaviour: the middle day of the season, in the season's own weather."""
    return [_whole((0, MIDDLE), c.wind.shape[2])]


def closest_day(years: int) -> Method:
    """One day: the candidate whose daily means are closest to the season's, from ``years`` years of weather."""

    def method(c: SeasonConditions) -> Plan:
        target, scale = _target_and_scale(c)
        daily = _daily(c)[:years]
        distance = (((daily - target) / scale) ** 2).sum(-1)
        year, day = np.unravel_index(np.argmin(distance), distance.shape)
        return [_whole((int(year), int(day)), c.wind.shape[2])]

    method.__name__ = f"closest_1_pool{years}"
    return method


def _terciles(values: np.ndarray, reference: np.ndarray) -> np.ndarray:
    """Which third of ``reference`` each of ``values`` falls in: 0, 1 or 2."""
    low, high = np.quantile(reference, [1 / 3, 2 / 3])
    return np.digitize(values, [low, high])


def latin_three(years: int) -> Method:
    """Three days, one from each wind third and each PV third (a Latin square on the 3×3 grid), choosing the
    combination whose mean is closest to the season's. Thirds are the season's own; candidates come from
    ``years`` years of weather.
    """

    def method(c: SeasonConditions) -> Plan:
        target, scale = _target_and_scale(c)
        daily = _daily(c)[:years].reshape(-1, 3)
        sources = [(year, day) for year in range(years) for day in range(c.wind.shape[1])]
        season = _daily(c)[0]
        wind_third = _terciles(daily[:, 0], season[:, 0])
        pv_third = _terciles(daily[:, 1], season[:, 1])
        normalised = (daily - target) / scale
        best: tuple[float, tuple[int, int, int]] | None = None
        for pv_of_wind in itertools.permutations(range(3)):
            cells = [np.flatnonzero((wind_third == w) & (pv_third == pv_of_wind[w])) for w in range(3)]
            if any(len(cell) == 0 for cell in cells):
                continue
            a, b, d = (normalised[cell] for cell in cells)
            mean = (a[:, None, None, :] + b[None, :, None, :] + d[None, None, :, :]) / 3
            distance = (mean**2).sum(-1)
            i, j, k = np.unravel_index(np.argmin(distance), distance.shape)
            if best is None or distance[i, j, k] < best[0]:
                best = (float(distance[i, j, k]), (cells[0][i], cells[1][j], cells[2][k]))
        assert best is not None, "no Latin square fits the season"
        return [_whole(sources[index], c.wind.shape[2]) for index in best[1]]

    method.__name__ = f"latin_3_pool{years}"
    return method


def stitched_day(segments: int = 3) -> Method:
    """One synthetic day of ``segments`` equal segments, each from a different real day of the season. Each
    segment comes from a different third of that segment's wind (a Latin assignment), and the combination is
    the one whose mean is closest to the season's.
    """

    def method(c: SeasonConditions) -> Plan:
        target, scale = _target_and_scale(c)
        clearings = c.wind.shape[2]
        length = clearings // segments
        windows = [slice(s * length, (s + 1) * length) for s in range(segments)]
        # Per segment window: each season day's means over that window, shape [day, feature].
        parts = [
            np.stack([c.wind[0][:, w].mean(1), c.pv[0][:, w].mean(1), c.demand[0][:, w].mean(1)], axis=-1)
            for w in windows
        ]
        best: tuple[float, tuple[int, ...]] | None = None
        for third_of_window in itertools.permutations(range(segments)):
            cells = [
                np.flatnonzero(_terciles(part[:, 0], part[:, 0]) == third_of_window[s]) for s, part in enumerate(parts)
            ]
            # The day's mean is the mean of its equal segments.
            normalised = [(parts[s][cells[s]] / segments - target / segments) / scale for s in range(segments)]
            mean = normalised[0][:, None, None, :] + normalised[1][None, :, None, :] + normalised[2][None, None, :, :]
            distance = (mean**2).sum(-1)
            i, j, k = np.unravel_index(np.argmin(distance), distance.shape)
            if best is None or distance[i, j, k] < best[0]:
                best = (float(distance[i, j, k]), (cells[0][i], cells[1][j], cells[2][k]))
        assert best is not None
        day = [(0, int(best[1][s])) for s in range(segments) for _ in range(length)]
        return [day]

    method.__name__ = f"stitched_1_seg{segments}"
    return method


WEEK = 7
MIDDLE_WEEK = MIDDLE - WEEK // 2  # season days 42–48, centred on the middle day


def best_week(c: SeasonConditions) -> Plan:
    """The 7-day run of the season whose mean (wind, PV, demand) is closest to the season's, taken whole."""
    target, scale = _target_and_scale(c)
    daily = _daily(c)[0]
    runs = np.array([daily[s : s + WEEK].mean(0) for s in range(len(daily) - WEEK + 1)])
    start = int(np.argmin((((runs - target) / scale) ** 2).sum(-1)))
    return [_whole((0, start + d), c.wind.shape[2]) for d in range(WEEK)]


def borrowed_weather(c: SeasonConditions) -> tuple[np.ndarray, np.ndarray, int, int]:
    """The representative week's wind and PV shares, [day, clearing], and the runs they borrow weather from.

    The middle week keeps its own calendar (sun position, seasonal and daily wind factors). Wind borrows the
    noise and PV the clear-sky index of a 7-day run of the season, each picking, independently, the run whose
    weather on the middle week gives the mean output closest to the season's real mean output.
    """
    week = slice(MIDDLE_WEEK, MIDDLE_WEEK + WEEK)
    starts = range(c.wind.shape[1] - WEEK + 1)

    def pick(
        weather: np.ndarray,
        calendar: np.ndarray,
        share: Callable[[np.ndarray, np.ndarray], np.ndarray],
        real: np.ndarray,
    ) -> tuple[np.ndarray, int]:
        options = [share(weather[s : s + WEEK], calendar[week]) for s in starts]
        start = int(np.argmin([abs(o.mean() - real.mean()) for o in options]))
        return options[start], start

    wind, wind_start = pick(c.wind_noise, c.wind_calendar, wind_share, c.wind[0])
    pv, pv_start = pick(c.csi, c.clear_sky, pv_share, c.pv[0])
    return wind, pv, wind_start, pv_start


#: The year index ``evaluate.py`` stores the representative week's borrowed weather under.
SYNTHETIC_YEAR = 1


def representative_week(c: SeasonConditions) -> Plan:
    """The chosen design (ADR-0008): the middle week, with weather borrowed as in ``borrowed_weather`` (stored as
    ``SYNTHETIC_YEAR``). ``evaluate.py`` scales its demand to the season's mean, as its ``scales_demand`` says.
    """
    return [_whole((SYNTHETIC_YEAR, MIDDLE_WEEK + d), c.wind.shape[2]) for d in range(WEEK)]


def representative_week_own_demand(c: SeasonConditions) -> Plan:
    """The representative week as #1197 first specified it, keeping the middle week's own demand."""
    return representative_week(c)


#: Methods whose demand is scaled so the plan's mean demand equals the season's.
representative_week.scales_demand = True  # type: ignore[attr-defined]
