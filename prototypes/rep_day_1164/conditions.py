"""Clearing conditions for #1164: weather and demand per (year, day of year, clearing), precomputed.

A *source* is ``(year, day)``: a day of the Workshop year, in year ``year`` of the weather. Year 0 is the
season actually being played. Other years are extra weather from the same generator and seed, used to
enlarge the pool of candidate days. Weather in year ``y`` is the generator at ``seconds + y * YEAR``, which
is also how per-Round weather would work if time included the Round.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from energetica.sim.national_demand import national_demand_curve
from energetica.sim.renewables import (
    SOLAR_FULL_POWER_IRRADIANCE,
    calculate_solar_irradiance,
    calculate_wind_speed,
    solar_power_fraction,
    wind_power_fraction,
)
from energetica.workshop.demand_block import DAYS_PER_YEAR, SettlementPeriod, nominal_demand
from energetica.workshop.facilities import FacilityCategory
from energetica.workshop.trading import WEATHER_POSITION, season_days

DAY = 86_400
YEAR = DAYS_PER_YEAR * DAY


@dataclass
class SeasonConditions:
    """Hourly shares and demand for every day of one season, in each year of the pool.

    Arrays are indexed ``[year, season_day, clearing]``. ``days`` maps a season-day index to a day of the year.
    """

    seed: int
    season: str
    days: list[int]
    wind: np.ndarray
    pv: np.ndarray
    demand: np.ndarray  # demand shape factor, amplitude 1
    # Year 0 only, [season_day, clearing]: the parts the representative week (#1197) recombines.
    wind_noise: np.ndarray  # the weather part of the wind speed
    wind_calendar: np.ndarray  # seasonal factor × daily factor × 85, from the date alone
    csi: np.ndarray  # clear-sky index: the weather part of solar
    clear_sky: np.ndarray  # clear-sky irradiance, from the sun's position alone

    def share(self, category: FacilityCategory, year: int, season_day: int, clearing: int) -> float:
        if category is FacilityCategory.WIND:
            return float(self.wind[year, season_day, clearing])
        return float(self.pv[year, season_day, clearing])


def season_conditions(seed: int, season: str, years: int, clearings_per_day: int = 24) -> SeasonConditions:
    days = season_days(season)  # type: ignore[arg-type]
    step = DAY / clearings_per_day
    wind = np.empty((years, len(days), clearings_per_day))
    pv = np.empty_like(wind)
    wind_noise = np.empty((len(days), clearings_per_day))
    wind_calendar, csi, clear_sky = (np.empty_like(wind_noise) for _ in range(3))
    for year in range(years):
        for i, day in enumerate(days):
            for k in range(clearings_per_day):
                s = year * YEAR + day * DAY + k * step
                speed = calculate_wind_speed(WEATHER_POSITION, s, seed, DAYS_PER_YEAR)
                irradiance, sky, index = calculate_solar_irradiance(WEATHER_POSITION, s, seed, DAYS_PER_YEAR)
                wind[year, i, k] = wind_power_fraction(speed)
                pv[year, i, k] = solar_power_fraction(irradiance)
                if year == 0:
                    calendar = _wind_calendar(s)
                    wind_noise[i, k], wind_calendar[i, k] = speed / calendar, calendar
                    csi[i, k], clear_sky[i, k] = index, sky
    curve = national_demand_curve()
    demand = np.array(
        [
            [nominal_demand(1.0, curve, SettlementPeriod(day, k, clearings_per_day)) for k in range(clearings_per_day)]
            for day in days
        ]
    )
    # Demand depends only on the date, so every year has the same.
    demand = np.broadcast_to(demand, wind.shape).copy()
    return SeasonConditions(seed, season, days, wind, pv, demand, wind_noise, wind_calendar, csi, clear_sky)


def _wind_calendar(seconds: float) -> float:
    """The factors of ``calculate_wind_speed`` that depend only on the date and time of day."""
    t = seconds / 60
    seasonal = 1 + 0.4 * math.sin(t / 60 / 24 / DAYS_PER_YEAR * math.pi * 2 + 0.5 * math.pi)
    daily = 1 + 0.1 * math.sin(t / 60 / 24 * math.pi * 2 + 0.4 * math.pi)
    return seasonal * daily * 85


def wind_share(noise: np.ndarray, calendar: np.ndarray) -> np.ndarray:
    return np.vectorize(wind_power_fraction)(noise * calendar)


def pv_share(csi: np.ndarray, clear_sky: np.ndarray) -> np.ndarray:
    return np.minimum(SOLAR_FULL_POWER_IRRADIANCE, csi * clear_sky) / SOLAR_FULL_POWER_IRRADIANCE


def is_weather(category: FacilityCategory) -> bool:
    return category in (FacilityCategory.WIND, FacilityCategory.PV, FacilityCategory.CSP)
