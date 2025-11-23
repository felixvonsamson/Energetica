"""Schemas for API routes for projects."""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, Field

from energetica.enums import PowerFacilityType, ProjectStatus, ProjectType
from energetica.globals import engine
from energetica.technology_effects import package_power_facilities

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
            display_name=engine.const_config["assets"][ongoing_project.project_type]["name"],
            level=ongoing_project.level,
            speed=ongoing_project.speed,
        )


class ProjectListOut(BaseModel):
    # TODO(mglst): it would make more sense for projects to be broken up into constructions_projects and
    # research_projects. For example, when cancelling a research project, we need to also fetch all constructions.
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


class RequirementOut(BaseModel):
    """Represents a requirement for building a facility or researching technology."""

    name: str
    level: int
    status: Literal["satisfied", "queued", "unsatisfied"]


class PowerFacilityCatalogOut(BaseModel):
    """Represents a power facility available for construction."""

    name: PowerFacilityType
    description: str
    wikipedia_link: str
    price: float
    construction_power: float
    construction_time: float
    construction_pollution: float | None = None
    requirements: list[RequirementOut]
    requirements_status: str  # "satisfied", "queued", or "unsatisfied"
    power_generation: float
    ramping_time: float | None = None
    ramping_speed: float | None = None
    capacity_factor: str | None = None
    operating_costs: float
    lifespan: float
    consumed_resources: dict[str, float]
    pollution: float | None = None
    high_hydro_cost: bool | None = None
    low_wind_speed: bool | None = None


class PowerFacilityCatalogListOut(BaseModel):
    """List of all power facilities available for construction."""

    power_facilities: list[PowerFacilityCatalogOut]

    @classmethod
    def from_player(cls, player: Player) -> PowerFacilityCatalogListOut:
        """Create a catalog from the player's current state."""
        raw_data = package_power_facilities(player)
        facilities = []
        for facility_data in raw_data:
            # Convert requirements
            requirements = [
                RequirementOut(
                    name=req["name"],
                    level=req["level"],
                    status=req["status"],
                )
                for req in facility_data["requirements"]
            ]

            # Create the facility catalog entry
            facilities.append(
                PowerFacilityCatalogOut(
                    name=facility_data["name"],
                    description=facility_data["description"],
                    wikipedia_link=facility_data["wikipedia_link"],
                    price=facility_data["price"],
                    construction_power=facility_data["construction_power"],
                    construction_time=facility_data["construction_time"],
                    construction_pollution=facility_data.get("construction_pollution"),
                    requirements=requirements,
                    requirements_status=facility_data["requirements_status"],
                    power_generation=facility_data["power_generation"],
                    ramping_time=facility_data.get("ramping_time"),
                    ramping_speed=facility_data.get("ramping_speed"),
                    capacity_factor=facility_data.get("capacity_factor"),
                    operating_costs=facility_data["operating_costs"],
                    lifespan=facility_data["lifespan"],
                    consumed_resources=facility_data["consumed_resources"],
                    pollution=facility_data.get("pollution"),
                    high_hydro_cost=facility_data.get("high_hydro_cost"),
                    low_wind_speed=facility_data.get("low_wind_speed"),
                ),
            )

        return PowerFacilityCatalogListOut(power_facilities=facilities)
