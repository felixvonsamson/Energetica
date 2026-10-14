"""The weather of a Workshop Run, and the representative week's borrowed weather (#1164, #1198, ADR-0008).

The weather is ``sim.renewables`` at one fixed position, since Workshop has no map, with a random seed per Run.
Each Round is a year of its own, so a season's weather differs from one Round to the next. The calendar (the
sun's position, the seasonal and daily wind factors) is the same every year. A Round's year of weather starts on
day 56, about 1 March, with its spring, so winter's weather runs on over the new year, and into the next Round's
spring.

In the representative-week format, a Trading period clears the middle week of its season. Wind and solar each
borrow only their weather from a 7-day run of the season: the noise term for wind, the clear-sky index (cloud
cover) for solar. The calendar stays the middle week's. Each picks, independently, the run whose weather placed on
the middle week gives the average output closest to the season's real average output. Hydro follows a fixed
table, so it borrows nothing.

The runs are picked from hourly samples, whatever the Round's clearings per day, so the choice is the same at any
clearing frequency.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from functools import cache
from threading import Lock
from typing import Protocol

import numpy as np
import numpy.typing as npt

from energetica.sim.renewable_curves import RIVER_FLOW_SPEED_SEASONAL
from energetica.sim.renewables import (
    SOLAR_FULL_POWER_IRRADIANCE,
    calculate_river_speed,
    calculate_solar_irradiance,
    calculate_wind_speed,
    clear_sky_index,
    clear_sky_irradiance,
    hydro_power_fraction,
    solar_power_fraction,
    wind_calendar_factor,
    wind_power_fraction,
    wind_speed_noise,
)
from energetica.workshop.demand_block import DAYS_PER_YEAR
from energetica.workshop.facilities import CATALOG, FacilityCategory, FacilityId
from energetica.workshop.seasons import (
    MIDDLE_WEEK_START,
    SEASONS,
    SPRING_START,
    WEEK_DAYS,
    Season,
    season_days,
)

Array = npt.NDArray[np.float64]

SECONDS_PER_HOUR = 3_600
SECONDS_PER_DAY = 86_400

#: Where every facility stands for the weather, since Workshop has no map.
WEATHER_POSITION = (0.0, 0.0)

Shares = Callable[[FacilityId, float], float]
"""The share of its power a renewable facility produces at a time, in seconds from 1 January, from 0 to 1."""


@dataclass(frozen=True, slots=True)
class AverageOutput:
    """The average share of its power a facility produces over a season, from 0 to 1."""

    wind: float
    solar: float


#: The real average wind and solar output of a normal season: :func:`normal_output` over seeds 0 to 127. The Recap
#: tells each season's weather against it (#1200). Work it out again if the weather changes.
NORMAL_OUTPUT: dict[Season, AverageOutput] = {
    "spring": AverageOutput(wind=0.4185, solar=0.1481),
    "summer": AverageOutput(wind=0.2341, solar=0.1917),
    "autumn": AverageOutput(wind=0.5165, solar=0.0955),
    "winter": AverageOutput(wind=0.6367, solar=0.0514),
}


@dataclass(frozen=True, slots=True)
class SeasonWeather:
    """The weather of one season of a Round."""

    shares: Shares
    """The season's own weather, for the full-season format."""
    week: Shares
    """The representative week's weather: the middle week of the season, with borrowed weather. Only for the
    days of :func:`~energetica.workshop.seasons.representative_week`."""
    average_output: AverageOutput
    """The season's real average wind and solar output."""
    wind_run: int
    """The day of the season, counted from 0, that the run the week borrows its wind from starts on."""
    solar_run: int
    """The day of the season, counted from 0, that the run the week borrows its clouds from starts on."""


class Weather(Protocol):
    """The weather of one Round of a Run."""

    def season(self, season: Season, /) -> SeasonWeather:
        """The weather of ``season``."""
        ...


def closest_run(weather: Array, calendar: Array, output: Callable[[Array, Array], Array]) -> int:
    """The day of the season that the 7-day run of weather closest to the season's starts on.

    ``weather`` and ``calendar`` hold the weather's and the calendar's part at each sample of each day of the
    season, as ``[day, sample]``. ``output`` turns the two into a share of power. The run picked is the one whose
    weather, placed on the calendar of the middle week, gives the average output closest to the season's real
    average output. Ties go to the earliest run.
    """
    target = output(weather, calendar).mean()
    middle_week = calendar[MIDDLE_WEEK_START : MIDDLE_WEEK_START + WEEK_DAYS]
    starts = range(len(weather) - WEEK_DAYS + 1)
    misses = [abs(output(weather[start : start + WEEK_DAYS], middle_week).mean() - target) for start in starts]
    return int(np.argmin(misses))


def _wind_output(noise: Array, calendar: Array) -> Array:
    return np.vectorize(wind_power_fraction, otypes=[np.float64])(noise * calendar)


def _solar_output(csi: Array, clear_sky: Array) -> Array:
    return np.minimum(SOLAR_FULL_POWER_IRRADIANCE, csi * clear_sky) / SOLAR_FULL_POWER_IRRADIANCE


def _average_output(noise: Array, csi: Array, wind_calendar: Array, clear_sky: Array) -> AverageOutput:
    return AverageOutput(
        wind=float(_wind_output(noise, wind_calendar).mean()),
        solar=float(_solar_output(csi, clear_sky).mean()),
    )


def _hours(season: Season) -> list[list[float]]:
    """The time of each hourly sample of each day of ``season``, in seconds from 1 January."""
    return [[day * SECONDS_PER_DAY + hour * SECONDS_PER_HOUR for hour in range(24)] for day in season_days(season)]


@cache
def _calendar(season: Season) -> tuple[Array, Array]:
    """The calendar's part of the wind and of solar at each hourly sample of ``season``, as ``[day, hour]``: the
    wind's seasonal and daily factors, and the clear-sky irradiance. The same in every Run and every Round.
    """
    wind = [[wind_calendar_factor(t, DAYS_PER_YEAR) for t in day] for day in _hours(season)]
    sun = [[clear_sky_irradiance(WEATHER_POSITION, t, DAYS_PER_YEAR) for t in day] for day in _hours(season)]
    return np.array(wind, dtype=np.float64), np.array(sun, dtype=np.float64)


@dataclass(frozen=True, slots=True)
class RunWeather:
    """The weather of Round ``round_number`` of a Run whose random seed is ``seed``."""

    seed: int
    round_number: int = 1

    def _weather_time(self, seconds: float) -> float:
        """Where ``seconds`` from 1 January of the Round's year falls in the weather's time. January and February
        come after the Round's December.
        """
        year = DAYS_PER_YEAR * SECONDS_PER_DAY
        after_new_year = seconds < SPRING_START * SECONDS_PER_DAY
        return (self.round_number - 1 + after_new_year) * year + seconds

    def share(self, facility: FacilityId, seconds: float, weather_seconds: float | None = None) -> float:
        """The share of its power ``facility`` produces at ``seconds`` from 1 January, under the weather of
        ``weather_seconds``, which defaults to the same time.
        """
        if weather_seconds is None:
            weather_seconds = seconds
        borrowed = self._weather_time(weather_seconds)
        match CATALOG[facility].category:
            case FacilityCategory.WIND:
                speed = calculate_wind_speed(WEATHER_POSITION, seconds, self.seed, DAYS_PER_YEAR, borrowed)
                share = wind_power_fraction(speed)
            case FacilityCategory.PV | FacilityCategory.CSP:
                irradiance = calculate_solar_irradiance(WEATHER_POSITION, seconds, self.seed, DAYS_PER_YEAR, borrowed)
                share = solar_power_fraction(irradiance[0])
            case FacilityCategory.HYDRO:
                # The river table covers a year of its own length, so hydro reads it at the same share of the year.
                river_year = len(RIVER_FLOW_SPEED_SEASONAL)
                share = hydro_power_fraction(calculate_river_speed(seconds * river_year / DAYS_PER_YEAR, river_year))
            case _:
                raise ValueError(f"{facility} does not follow the weather")
        # ``sim.renewables`` computes with numpy, so its results are numpy floats. Saved results need plain ones.
        return float(share)

    def _samples(self, season: Season) -> tuple[Array, Array]:
        """The weather's part of the wind and of solar at each hourly sample of ``season``, as ``[day, hour]``: the
        wind's noise term and the clear-sky index.
        """

        def sample(part: Callable[[float], float]) -> Array:
            times = _hours(season)
            return np.array([[part(self._weather_time(t)) for t in day] for day in times], dtype=np.float64)

        noise = sample(lambda t: wind_speed_noise(WEATHER_POSITION, t, self.seed))
        csi = sample(lambda t: clear_sky_index(WEATHER_POSITION, t, self.seed))
        return noise, csi

    def average_output(self, season: Season, /) -> AverageOutput:
        """The real average wind and solar output of ``season``, without picking the runs the week borrows from."""
        wind_calendar, clear_sky = _calendar(season)
        return _average_output(*self._samples(season), wind_calendar, clear_sky)

    def season(self, season: Season, /) -> SeasonWeather:
        """The weather of ``season``, with the runs its representative week borrows from."""
        days = season_days(season)
        noise, csi = self._samples(season)
        wind_calendar, clear_sky = _calendar(season)
        wind_run = closest_run(noise, wind_calendar, _wind_output)
        solar_run = closest_run(csi, clear_sky, _solar_output)

        def borrowed_days(run: int) -> dict[int, int]:
            """Each day of the middle week, and the day of the year it borrows the weather of."""
            week = days[MIDDLE_WEEK_START : MIDDLE_WEEK_START + WEEK_DAYS]
            return dict(zip(week, days[run : run + WEEK_DAYS], strict=True))

        wind_days, solar_days = borrowed_days(wind_run), borrowed_days(solar_run)

        def week(facility: FacilityId, seconds: float) -> float:
            match CATALOG[facility].category:
                case FacilityCategory.WIND:
                    borrowed = wind_days
                case FacilityCategory.PV | FacilityCategory.CSP:
                    borrowed = solar_days
                case _:
                    return self.share(facility, seconds)
            day, time_of_day = divmod(seconds, SECONDS_PER_DAY)
            if int(day) not in borrowed:
                raise ValueError(f"day {int(day)} is not in the representative week of {season}")
            return self.share(facility, seconds, borrowed[int(day)] * SECONDS_PER_DAY + time_of_day)

        return SeasonWeather(
            shares=self.share,
            week=week,
            average_output=_average_output(noise, csi, wind_calendar, clear_sky),
            wind_run=wind_run,
            solar_run=solar_run,
        )


def representative_weather(seed: int, round_number: int = 1) -> RunWeather:
    """The weather of Round ``round_number`` of a Run whose random seed is ``seed``."""
    return RunWeather(seed, round_number)


@cache
def _season_output(seed: int, round_number: int, season: Season) -> AverageOutput:
    return RunWeather(seed, round_number).average_output(season)


_season_output_lock = Lock()


def season_output(seed: int, round_number: int, season: Season) -> AverageOutput:
    """The real average wind and solar output of ``season`` in Round ``round_number`` of a Run whose random seed is
    ``seed``. Every player reads the Recap at once, so it is worked out once, by the first, and kept.
    """
    with _season_output_lock:
        return _season_output(seed, round_number, season)


def normal_output(seeds: range) -> dict[Season, AverageOutput]:
    """The average output of each season in Round 1 over ``seeds``: what a normal season gives. :data:`NORMAL_OUTPUT`
    holds it for ``range(128)``.
    """
    normal = {}
    for season in SEASONS:
        outputs = [RunWeather(seed).average_output(season) for seed in seeds]
        normal[season] = AverageOutput(
            wind=sum(output.wind for output in outputs) / len(outputs),
            solar=sum(output.solar for output in outputs) / len(outputs),
        )
    return normal
