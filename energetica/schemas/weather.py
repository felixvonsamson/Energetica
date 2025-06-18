"""Schemas for the weather api."""

from pydantic import BaseModel, Field


class WeatherOut(BaseModel):
    year_progress: float = Field(ge=0, le=1)
    month_number: int = Field(ge=1, le=12)
    solar_irradiance: float
    wind_speed: float
    river_discharge: float
