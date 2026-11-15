"""Schemas for API for game achievements."""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


class AchievementMilestoneOut(BaseModel):
    type: Literal["milestone"]
    id: str
    level: int
    reward: int
    objective: int
    status: int


class AchievementUnlockOut(BaseModel):
    type: Literal["unlock"]
    id: str
    reward: int
    objective: int
    status: int


AchievementOut = Annotated[
    Union[AchievementMilestoneOut, AchievementUnlockOut],
    Field(discriminator="type"),
]


class AchievementListOut(BaseModel):
    achievements: list[AchievementOut]
