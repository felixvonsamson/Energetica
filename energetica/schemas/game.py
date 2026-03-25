"""Schemas for game engine data API."""

import datetime

from pydantic import BaseModel


class GameEngineOut(BaseModel):
    """Game engine configuration and timing data."""

    start_date: datetime.datetime
    wall_clock_seconds_per_tick: int
    game_seconds_per_tick: int
