"""Schemas for API routes for projects."""

from __future__ import annotations

from pydantic import Field

from energetica.enums import ProjectStatus, ProjectType
from energetica.schemas.common import BaseApiModel


class ProjectOut(BaseApiModel):
    id: int
    type: ProjectType  # TODO(mglst): rename to just type
    end_tick: float | None = Field(description="Only present if project is ongoing")
    ticks_passed: float | None = Field(description="Only present if project is paused")
    duration: float
    status: ProjectStatus  # TODO(mglst): It would be better if the status were serialized as strings rather than ints
    display_name: str  # TODO(mglst): move this to the frontend
    level: int | None
    speed: float


class ProjectsOut(BaseApiModel):
    projects: list[ProjectOut]
    construction_queue: list[int]
    research_queue: list[int]


class ProjectIn(BaseApiModel):
    type: ProjectType
    pass


# Changes
# - list -> dict
# - end_tick_or_ticks_passed now split
# JS variable names to look out for
# * constructions_data
# * project_priority
