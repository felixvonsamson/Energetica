"""Schemas for the weather api."""

from typing import Literal

from pydantic import BaseModel

# TODO: the API should just give a month number and the frontend should convert to a month name
MonthName = Literal[
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]


class WeatherOut(BaseModel):
    year_progress: float
    month: MonthName  # TODO: rename from month to month_name
    solar_irradiance: float
    wind_speed: float
    river_discharge: float
