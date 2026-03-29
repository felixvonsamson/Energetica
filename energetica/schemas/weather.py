"""Schemas for the weather api."""

from pydantic import BaseModel, Field


class WeatherOut(BaseModel):
    year_progress: float = Field(ge=0, le=1, description="Fractional progression of the current year, from 0.0 to 1.0")
    month_number: int = Field(ge=1, le=12, description="1=January, 2=February, ...")
    solar_irradiance: float = Field(description="Solar irradiance in W/m², capped at 950")
    clear_sky_value: float = Field(description="Clear sky irradiance in W/m² (before cloud cover)")
    clear_sky_index: float = Field(description="Clear sky index (0–1): fraction of clear sky irradiance reaching ground")
    wind_speed: float = Field(description="Wind speed in km/h")
    river_flow_speed: float = Field(description="River flow speed in m/s")
