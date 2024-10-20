import numpy as np
from numpy import cos, sin, pi, exp, dot, arccos
from numpy.linalg import norm

# Constants
TROPICAL_YEAR = 365.24219 * 24 * 3600  # seconds in a tropical year
EARTH_TILT_ANGLE = 23.5 / 180 * pi     # Earth tilt angle in radians
SIDEREAL_DAY = 86164.098903691         # seconds in a sidereal day
ABSORPTION_FACTOR = 0.28352711107      # Atmospheric absorption factor
TSI = 1360                             # Total Solar Irradiance (W/m^2)
T0 = 15011250                          # Earth's orbit initial phase
T1 = 33400                             # Earth's spin initial phase

@np.vectorize
def DrHI(unix_time, latitude, longitude):
    """
    Calculate Direct Horizontal Irradiance (DrHI) at a given time and location.

    Parameters:
    - unix_time: Time in UNIX timestamp (seconds since 1970-01-01)
    - latitude: Latitude in degrees (must be between -90 (excluded) and 90)
    - longitude: Longitude in degrees (can be between -180 (excluded) and 180)

    Returns:
    - DrHI: Direct horizontal irradiance in W/m^2
    """
    
    # Validate inputs
    if not (-90 < latitude <= 90):
        raise ValueError("Latitude must be between -90 (excluded) and 90 degrees.")
    if not (-180 < longitude <= 180):
        raise ValueError("Longitude must be between -180 (excluded) and 180 degrees.")

    # Convert to radians
    latitude = latitude / 180 * pi
    longitude = longitude / 180 * pi

    # Calculate Earth’s position in its orbit around the Sun (v1)
    orbital_phase = 2 * pi * (unix_time - T0) / TROPICAL_YEAR
    v1 = np.array([cos(orbital_phase), sin(orbital_phase), 0])
    
    # Calculate the observer's position on the Earth (v2)
    sidereal_phase = 2 * pi * (unix_time - T1) / SIDEREAL_DAY
    v2 = np.array([
        cos(latitude) * cos(longitude + sidereal_phase),
        cos(latitude) * sin(longitude + sidereal_phase),
        sin(latitude)
    ])
    
    # Rotation matrix for Earth's axial tilt
    rot_matrix = np.array([
        [cos(EARTH_TILT_ANGLE), 0, -sin(EARTH_TILT_ANGLE)],
        [0, 1, 0],
        [sin(EARTH_TILT_ANGLE), 0, cos(EARTH_TILT_ANGLE)]
    ])
    
    # Calculate the zenith angle (angle between the Sun's rays and the observer)
    zenith_angle = arccos(dot(-v1, rot_matrix @ v2) / (norm(v1) * norm(v2)))
    
    # Calculate solar elevation angle
    elevation = max(0, pi / 2 - zenith_angle)
    
    # Calculate Direct Normal Irradiance (DrNI)
    sin_elevation = sin(elevation)
    DrNI = exp(-ABSORPTION_FACTOR / sin_elevation) * TSI if sin_elevation > 0 else 0
        
    # Calculate Direct Horizontal Irradiance (DrHI)
    DrHI = DrNI * sin_elevation
    
    return DrHI

