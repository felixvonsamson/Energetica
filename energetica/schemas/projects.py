"""Schemas for API routes for projects."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

from energetica.enums import ProjectStatus, ProjectType
from energetica.globals import engine

if TYPE_CHECKING:
    from energetica.database.ongoing_project import OngoingProject
    from energetica.database.player import Player


class ProjectOut(BaseModel):
    id: int
    type: ProjectType
    end_tick: float | None = Field(description="Only present if project is ongoing")
    ticks_passed: float | None = Field(description="Only present if project is paused")
    duration: float
    status: ProjectStatus
    display_name: str  # TODO(mglst): move this to the frontend
    level: int | None
    speed: float

    @classmethod
    def from_ongoing_project(cls, ongoing_project: OngoingProject) -> ProjectOut:
        return ProjectOut(
            id=ongoing_project.id,
            type=ongoing_project.project_type,
            end_tick=ongoing_project.end_tick_or_ticks_passed if ongoing_project.is_ongoing else None,
            ticks_passed=None if ongoing_project.is_ongoing else ongoing_project.end_tick_or_ticks_passed,
            duration=ongoing_project.duration,
            status=ongoing_project.status,
            display_name=engine.new_config.get_base_config(ongoing_project.project_type).name,
            level=ongoing_project.level,
            speed=ongoing_project.speed,
        )


class ProjectListOut(BaseModel):
    # TODO(mglst): it would make more sense for projects to be broken up into constructions_projects and
    # research_projects. For example, when canceling a research project, we need to also fetch all constructions.
    # In fact separating them out would make construction_queue and research_queue redundant, which would be nice
    projects: list[ProjectOut]
    construction_queue: list[int]
    research_queue: list[int]

    @classmethod
    def from_player(cls, player: Player) -> ProjectListOut:
        projects = [
            ProjectOut.from_ongoing_project(project)
            for project in (*player.constructions_by_priority, *player.researches_by_priority)
        ]
        constructions_by_priority = [construction.id for construction in player.constructions_by_priority]
        researches_by_priority = [research.id for research in player.researches_by_priority]
        return ProjectListOut(
            projects=projects,
            construction_queue=constructions_by_priority,
            research_queue=researches_by_priority,
        )


class ProjectIn(BaseModel):
    type: ProjectType
