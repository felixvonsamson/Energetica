"""Routes for the weather API."""

from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.database.player import Player
from energetica.schemas.weather import WeatherOut
from energetica.utils import misc
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/weather", tags=["Weather"])


@router.get("")
def get_current_weather(player: Annotated[Player, Depends(get_settled_player)]) -> WeatherOut:
    """Get the current weather data including date, irradiance, wind speed, and river flow speed."""
    return misc.package_weather_data(player)
