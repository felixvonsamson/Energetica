"""Schemas for API routes for projects."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

from energetica.enums import ProjectType

if TYPE_CHECKING:
    from energetica.database.ongoing_project import ProjectStatus


class ProjectOut(BaseModel):
    id: int
    project_type: ProjectType
    end_tick: float | None = Field(description="Only present if project is ongoing")
    ticks_passed: float | None = Field(description="Only present if project is paused")
    duration: float
    status: ProjectStatus  # TODO(mglst): It would be better if the status were serialized as strings rather than ints


class ProjectsOut(BaseModel):
    projects: list[ProjectOut]
    construction_queue: list[int]
    research_queue: list[int]


class QueueProjectIn(BaseModel):
    pass


# Changes
# - list -> dict
# - end_tick_or_ticks_passed now split
