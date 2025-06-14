from __future__ import annotations

from pydantic import BaseModel


class AchievementResponse(BaseModel):
    achievements: list[Achievement]


class Achievement(BaseModel):
    id: str
    name: str
    reward: int
    objective: int
    status: int
