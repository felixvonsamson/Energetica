"""Schemas for the weather api."""

from pydantic import BaseModel, Field


class WeatherOut(BaseModel):
    year_progress: float = Field(ge=0, le=1, description="Fractional progression of the current year, from 0.0 to 1.0")
    month_number: int = Field(ge=1, le=12, description="1=January, 2=February, ...")
    solar_irradiance: float = Field(description="In units of TODO")
    wind_speed: float = Field(description="In units of TODO")
    river_discharge: float = Field(description="In units of TODO")
