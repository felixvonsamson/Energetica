"""Schemas for API for game achievements."""

from __future__ import annotations

from pydantic import BaseModel


class AchievementListOut(BaseModel):
    achievements: list[AchievementOut]


class AchievementOut(BaseModel):
    id: str
    name: str
    reward: int
    objective: int
    status: int
