import numpy as np
from numpy import arccos, cos, exp, pi, sin
from numpy.linalg import norm

# Constants
TROPICAL_YEAR = 365.24219 * 24 * 3600  # seconds in a tropical year
EARTH_TILT_ANGLE = 23.5 / 180 * pi  # Earth tilt angle in radians
SIDEREAL_DAY = 86164.098903691  # seconds in a sidereal day
ABSORPTION_FACTOR = 0.28352711107  # Atmospheric absorption factor
TSI = 1360  # Total Solar Irradiance (W/m^2)
T0 = 15011250  # Earth's orbit initial phase
T1 = 33400  # Earth's spin initial phase


def DrHI(unix_time, latitude, longitude):
    """Calculate Direct Horizontal Irradiance (DrHI) at a given time and location.

    Parameters
    ----------
    - unix_time: Time in UNIX timestamp (seconds since 1970-01-01)
    - latitude: Latitude in degrees (must be between -90 (excluded) and 90)
    - longitude: Longitude in degrees (can be between -180 (excluded) and 180)

    Returns
    -------
    - DrHI: Direct horizontal irradiance in W/m^2

    """
    # Validate inputs
    if not (np.all(latitude > -90) and np.all(latitude <= 90)):
        msg = "Latitude must be between -90 (excluded) and 90 degrees."
        raise ValueError(msg)
    if not (np.all(longitude > -180) and np.all(longitude <= 180)):
        msg = "Longitude must be between -180 (excluded) and 180 degrees."
        raise ValueError(msg)

    # Convert to radians
    latitude = latitude / 180 * pi
    longitude = longitude / 180 * pi

    # Calculate Earth’s position in its orbit around the Sun (v1)
    orbital_phase = 2 * pi * (unix_time - T0) / TROPICAL_YEAR
    v1 = np.stack([cos(orbital_phase), sin(orbital_phase), np.zeros_like(orbital_phase)], axis=-1)

    # Calculate the observer's position on the Earth (v2)
    sidereal_phase = 2 * pi * (unix_time - T1) / SIDEREAL_DAY
    v2 = np.stack(
        [
            cos(latitude) * cos(longitude + sidereal_phase),
            cos(latitude) * sin(longitude + sidereal_phase),
            sin(latitude) * np.ones_like(sidereal_phase),
        ],
        axis=-1,
    )

    # Rotation matrix for Earth's axial tilt
    rot_matrix = np.array(
        [
            [cos(EARTH_TILT_ANGLE), 0, -sin(EARTH_TILT_ANGLE)],
            [0, 1, 0],
            [sin(EARTH_TILT_ANGLE), 0, cos(EARTH_TILT_ANGLE)],
        ]
    )

    # Calculate the zenith angle (angle between the Sun's rays and the observer)
    zenith_angle = arccos(
        (-v1[..., None, :] @ (rot_matrix @ v2[..., None]))[..., 0, 0] / (norm(v1, axis=-1) * norm(v2, axis=-1))
    )

    # Calculate solar elevation angle
    elevation = np.maximum(0, pi / 2 - zenith_angle)

    # Calculate Direct Normal Irradiance (DrNI)
    sin_elevation = sin(elevation)
    DrNI = exp(-ABSORPTION_FACTOR / np.maximum(sin_elevation, 1e-8)) * TSI

    # Calculate Direct Horizontal Irradiance (DrHI)
    DrHI = DrNI * sin_elevation

    return DrHI
