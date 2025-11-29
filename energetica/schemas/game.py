"""Schemas for game engine data API."""

from pydantic import BaseModel


class GameEngineOut(BaseModel):
    """Game engine configuration and timing data."""

    wall_clock_seconds_per_tick: int
    game_seconds_per_tick: int
