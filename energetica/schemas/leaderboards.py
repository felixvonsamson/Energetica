"""Schemas for API for the leaderboards."""

from __future__ import annotations

from pydantic import BaseModel


class LeaderboardsOut(BaseModel):
    rows: list[LeaderboardRowOut]
    pass


class LeaderboardRowOut(BaseModel):
    player_id: int
    username: str
    network_name: str | None
    average_hourly_revenues: float
    max_power_consumption: float
    total_technology_levels: int
    xp: int
    co2_emissions: float | None
