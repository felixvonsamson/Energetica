"""Weather and output of wind, solar and hydro facilities.

Pure functions of a position, a time in seconds, and a random seed, so every mode of play gets the same
weather from the same inputs. A mode without a map can pass a fixed position, such as ``(0, 0)``, for every
facility. ``noise`` supplies the Perlin noise; everything else is standard library.

The caller passes the length of the game year in days, because it belongs to the mode's configuration.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta

import numpy as np
from noise import pnoise3
from scipy.stats import norm

from energetica.sim.astro import DrHI
from energetica.sim.renewable_curves import RIVER_FLOW_SPEED_SEASONAL, WIND_POWER_CURVE

#: Irradiance, in W/m^2, at which a solar facility produces its full power. Irradiance is capped here too.
SOLAR_FULL_POWER_IRRADIANCE = 950.0
#: The fastest river flow, in m/s. A hydro facility produces its full power at this flow.
MAX_RIVER_SPEED = 2.5
#: Wind speed at and above which a wind facility is past the last full-power entry of the power curve
#: and starts to taper towards cut-out.
WIND_CUT_OUT_SPEED = 85


def calculate_solar_irradiance(
    position: tuple[float, float], total_seconds: float, random_seed: int, days_per_year: int
) -> tuple[float, float, float]:
    """
    Calculate the solar irradiance for a given location and time.

    The clear sky index is derived from a 3d perlin noise function that moves in time to simulate the cloud cover.
    The clear sky index is then multiplied by the clear sky irradiance to get the solar irradiance.
    The irradiance is capped at :data:`SOLAR_FULL_POWER_IRRADIANCE`.

    Returns:
        (solar_irradiance, clear_sky_value, clear_sky_index)
    """

    def transformation(noise_value: float, threshold: float = 0, smoothness: float = 2) -> float:
        """Sigmoid transformation."""
        return 1 / (1 + np.exp(-(noise_value - threshold) * 10 / smoothness))

    # Calculate the real day and time in a year for a given tick
    start_date = datetime(2023, 7, 1)  # 6 months offset because i'm using the southern hemisphere
    day_of_year = int((total_seconds / 3600 / 24 / days_per_year) % 1 * 365)
    time_of_day = total_seconds % (3600 * 24)
    weather_datetime = start_date + timedelta(days=day_of_year, seconds=time_of_day)

    x_noise = position[0] + total_seconds / 2400
    y_noise = position[1] + total_seconds / 4000
    t = total_seconds / 3600 / 24
    regional_noise = pnoise3(
        x_noise / 50,
        y_noise / 50,
        t,
        octaves=2,
        persistence=0.5,
        lacunarity=2.0,
        base=random_seed,
    )
    regional_noise = transformation(regional_noise, smoothness=1) * 2 - 1
    cloud_cover_noise = pnoise3(x_noise, y_noise, t, octaves=6, persistence=0.5, lacunarity=2.0, base=random_seed)
    cloud_cover_noise = transformation(
        cloud_cover_noise,
        threshold=0.5 * regional_noise,
        smoothness=max(0.3, 1 - regional_noise),
    )
    csi = 1 - min(0.9, 5 - regional_noise * 5) * cloud_cover_noise
    clear_sky = DrHI(weather_datetime.timestamp(), (position[1] - 10) * 85 / 21, 0)
    return min(SOLAR_FULL_POWER_IRRADIANCE, csi * clear_sky), clear_sky, csi


def calculate_wind_speed(
    position: tuple[float, float], total_seconds: float, random_seed: int, days_per_year: int
) -> float:
    """
    Calculate the wind speed for a given location and time.

    The wind speed is derived from a 3d perlin noise function with a superposition of specific frequencies.
    Two sinusoidal functions are multiplied to the noise to simulate the diurnal and seasonal wind patterns.
    """
    x, y = position
    t = total_seconds / 60
    wind_speed_noise = (
        0.9 * pnoise3(x / 20, y / 20, t / 5760, base=random_seed)
        + 0.06 * pnoise3(x, y, t / 360, base=random_seed)
        + 0.03 * pnoise3(x * 3, y * 3, t / 90, base=random_seed)
        + 0.007 * pnoise3(x * 18, y * 18, t / 15, base=random_seed)
        + 0.003 * pnoise3(x * 108, y * 108, t / 2.5, base=random_seed)
    )
    wind_speed_noise = norm.cdf(wind_speed_noise, loc=0, scale=0.15)
    wind_speed_noise = (1 - (1 - wind_speed_noise) ** 0.1282) ** 0.4673
    return (
        wind_speed_noise
        * (1 + 0.4 * math.sin(t / 60 / 24 / days_per_year * math.pi * 2 + 0.5 * math.pi))
        * (1 + 0.1 * math.sin(t / 60 / 24 * math.pi * 2 + 0.4 * math.pi))
        * 85
    )  # type: ignore


def calculate_river_speed(total_seconds: float, days_per_year: int) -> float:
    """Calculate the river flow speed, in m/s, by interpolating the values from the seasonal variation."""
    days_since_start = math.floor(total_seconds / 3600 / 24)
    current_day_fraction = (total_seconds % (3600 * 24)) / (3600 * 24)
    flow_factor = RIVER_FLOW_SPEED_SEASONAL[days_since_start % days_per_year] + current_day_fraction * (
        RIVER_FLOW_SPEED_SEASONAL[(days_since_start + 1) % days_per_year]
        - RIVER_FLOW_SPEED_SEASONAL[days_since_start % days_per_year]
    )
    return flow_factor * MAX_RIVER_SPEED


def wind_power_fraction(wind_speed: float) -> float:
    """Return the share of its power a wind facility produces at ``wind_speed``, interpolating the power curve."""
    if wind_speed > 90:
        return 0
    i = math.floor(wind_speed)
    f = wind_speed - i
    pc = WIND_POWER_CURVE
    return pc[i] + (pc[(i + 1) % 90] - pc[i]) * f


def solar_power_fraction(irradiance: float) -> float:
    """Return the share of its power a solar facility produces under ``irradiance`` (W/m^2)."""
    return irradiance / SOLAR_FULL_POWER_IRRADIANCE


def hydro_power_fraction(river_speed: float) -> float:
    """Return the share of its power a hydro facility produces at ``river_speed`` (m/s), from 0 to 1."""
    return river_speed / MAX_RIVER_SPEED
