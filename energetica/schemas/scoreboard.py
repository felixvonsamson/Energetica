from __future__ import annotations

from pydantic import BaseModel


class ScoreboardResponse(BaseModel):
    rows: list[ScoreboardRow]
    pass


class ScoreboardRow(BaseModel):
    player_id: int
    username: str
    network_name: str | None
    average_hourly_revenues: float
    max_power_consumption: float
    total_technology_levels: int
    xp: int
    co2_emissions: float | None
