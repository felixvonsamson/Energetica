"""Astronomical calculations for solar irradiance.

Pure standard-library maths, so that :mod:`energetica.sim` needs no numerical package beyond ``noise``.
"""

from __future__ import annotations

import math

# Constants
TROPICAL_YEAR = 365.24219 * 24 * 3600  # seconds in a tropical year
EARTH_TILT_ANGLE = 23.5 / 180 * math.pi  # Earth tilt angle in radians
SIDEREAL_DAY = 86164.098903691  # seconds in a sidereal day
ABSORPTION_FACTOR = 0.28352711107  # Atmospheric absorption factor
TSI = 1360  # Total Solar Irradiance (W/m^2)
T0 = 15011250  # Earth's orbit initial phase
T1 = 33400  # Earth's spin initial phase


def direct_horizontal_irradiance(unix_time: float, latitude: float, longitude: float) -> float:
    """
    Calculate Direct Horizontal Irradiance (DrHI) at a given time and location.

    Parameters
    ----------
    - unix_time: Time in UNIX timestamp (seconds since 1970-01-01)
    - latitude: Latitude in degrees (must be between -90 (excluded) and 90)
    - longitude: Longitude in degrees (can be between -180 (excluded) and 180)

    Returns
    -------
    - DrHI: Direct horizontal irradiance in W/m^2

    """
    if not (-90 < latitude <= 90):
        msg = "Latitude must be between -90 (excluded) and 90 degrees."
        raise ValueError(msg)
    if not (-180 < longitude <= 180):
        msg = "Longitude must be between -180 (excluded) and 180 degrees."
        raise ValueError(msg)

    latitude = latitude / 180 * math.pi
    longitude = longitude / 180 * math.pi

    # Earth's position in its orbit around the Sun (v1)
    orbital_phase = 2 * math.pi * (unix_time - T0) / TROPICAL_YEAR
    v1 = (math.cos(orbital_phase), math.sin(orbital_phase), 0.0)

    # The observer's position on the Earth (v2)
    sidereal_phase = 2 * math.pi * (unix_time - T1) / SIDEREAL_DAY
    v2 = (
        math.cos(latitude) * math.cos(longitude + sidereal_phase),
        math.cos(latitude) * math.sin(longitude + sidereal_phase),
        math.sin(latitude),
    )

    # Rotate the observer's position for Earth's axial tilt
    cos_tilt = math.cos(EARTH_TILT_ANGLE)
    sin_tilt = math.sin(EARTH_TILT_ANGLE)
    tilted = (
        cos_tilt * v2[0] - sin_tilt * v2[2],
        v2[1],
        sin_tilt * v2[0] + cos_tilt * v2[2],
    )

    # The zenith angle is the angle between the Sun's rays and the observer. Rounding can push the cosine a
    # hair outside [-1, 1], which ``acos`` rejects, so it is clamped.
    cos_zenith = -(v1[0] * tilted[0] + v1[1] * tilted[1] + v1[2] * tilted[2]) / (math.hypot(*v1) * math.hypot(*v2))
    zenith_angle = math.acos(max(-1.0, min(1.0, cos_zenith)))

    elevation = max(0.0, math.pi / 2 - zenith_angle)

    # Direct Normal Irradiance (DrNI), then Direct Horizontal Irradiance (DrHI)
    sin_elevation = math.sin(elevation)
    dr_ni = math.exp(-ABSORPTION_FACTOR / max(sin_elevation, 1e-8)) * TSI
    return dr_ni * sin_elevation
