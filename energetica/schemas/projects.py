"""Schemas for API routes for projects."""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, Field

from energetica.enums import (
    ExtractionFacilityType,
    FunctionalFacilityType,
    PowerFacilityType,
    ProjectStatus,
    ProjectType,
    StorageFacilityType,
    TechnologyType,
)
from energetica.globals import engine
from energetica.technology_effects import (
    package_available_technologies,
    package_extraction_facilities,
    package_functional_facilities,
    package_power_facilities,
    package_storage_facilities,
)

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
    requirements_status: Literal["satisfied", "queued", "unsatisfied"]
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
    wind_potential: float | None = None
    hydro_potential: float | None = None
    solar_potential: float | None = None


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
                    wind_potential=facility_data.get("wind_potential"),
                    hydro_potential=facility_data.get("hydro_potential"),
                    solar_potential=facility_data.get("solar_potential"),
                ),
            )

        return PowerFacilityCatalogListOut(power_facilities=facilities)


class StorageFacilityCatalogOut(BaseModel):
    """Represents a storage facility available for construction."""

    name: StorageFacilityType
    description: str
    wikipedia_link: str
    price: float
    construction_power: float
    construction_time: float
    construction_pollution: float | None = None
    requirements: list[RequirementOut]
    requirements_status: Literal["satisfied", "queued", "unsatisfied"]
    power_generation: float
    ramping_time: float | None = None
    ramping_speed: float | None = None
    capacity_factor: str | None = None
    operating_costs: float
    lifespan: float
    storage_capacity: float
    efficiency: float


class StorageFacilityCatalogListOut(BaseModel):
    """List of all storage facilities available for construction."""

    storage_facilities: list[StorageFacilityCatalogOut]

    @classmethod
    def from_player(cls, player: Player) -> StorageFacilityCatalogListOut:
        """Create a catalog from the player's current state."""
        raw_data = package_storage_facilities(player)
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
                StorageFacilityCatalogOut(
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
                    storage_capacity=facility_data["storage_capacity"],
                    efficiency=facility_data["efficiency"],
                ),
            )

        return StorageFacilityCatalogListOut(storage_facilities=facilities)


class ResourceProduction(BaseModel):
    """Represents resource production info for an extraction facility."""

    name: str
    rate: float


class ExtractionFacilityCatalogOut(BaseModel):
    """Represents an extraction facility available for construction."""

    name: ExtractionFacilityType
    description: str
    wikipedia_link: str
    price: float
    construction_power: float
    construction_time: float
    construction_pollution: float | None = None
    requirements: list[RequirementOut]
    requirements_status: Literal["satisfied", "queued", "unsatisfied"]
    operating_costs: float
    lifespan: float
    power_consumption: float
    pollution: float
    resource_production: ResourceProduction
    poor_resource_production: bool


class ExtractionFacilityCatalogListOut(BaseModel):
    """List of all extraction facilities available for construction."""

    extraction_facilities: list[ExtractionFacilityCatalogOut]

    @classmethod
    def from_player(cls, player: Player) -> ExtractionFacilityCatalogListOut:
        """Create a catalog from the player's current state."""
        raw_data = package_extraction_facilities(player)
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
                ExtractionFacilityCatalogOut(
                    name=facility_data["name"],
                    description=facility_data["description"],
                    wikipedia_link=facility_data["wikipedia_link"],
                    price=facility_data["price"],
                    construction_power=facility_data["construction_power"],
                    construction_time=facility_data["construction_time"],
                    construction_pollution=facility_data.get("construction_pollution"),
                    requirements=requirements,
                    requirements_status=facility_data["requirements_status"],
                    operating_costs=facility_data["operating_costs"],
                    lifespan=facility_data["lifespan"],
                    power_consumption=facility_data["power_consumption"],
                    pollution=facility_data["pollution"],
                    resource_production=ResourceProduction(
                        name=facility_data["resource_production"]["name"],
                        rate=facility_data["resource_production"]["rate"],
                    ),
                    poor_resource_production=facility_data["poor_resource_production"],
                ),
            )

        return ExtractionFacilityCatalogListOut(extraction_facilities=facilities)


class ValueChange(BaseModel):
    """Represents a value change from current to upgraded level."""

    current: float | None
    upgraded: float | None


class FunctionalFacilityCatalogOut(BaseModel):
    """Represents a functional facility available for construction/upgrade."""

    name: FunctionalFacilityType
    description: str
    wikipedia_link: str
    price: float
    construction_power: float
    construction_time: float
    construction_pollution: float | None = None
    requirements: list[RequirementOut]
    requirements_status: Literal["satisfied", "queued", "unsatisfied"]
    level: int
    # Industry specific
    average_consumption: ValueChange | None = None
    revenue_generation: ValueChange | None = None
    # Laboratory specific
    lab_workers: ValueChange | None = None
    research_speed_bonus: float | None = None
    # Warehouse specific
    warehouse_capacities: dict[str, ValueChange | None] | None = None
    # Carbon capture specific
    power_consumption: ValueChange | None = None
    co2_absorption: ValueChange | None = None


class FunctionalFacilityCatalogListOut(BaseModel):
    """List of all functional facilities available for construction."""

    functional_facilities: list[FunctionalFacilityCatalogOut]

    @classmethod
    def from_player(cls, player: Player) -> FunctionalFacilityCatalogListOut:
        """Create a catalog from the player's current state."""
        raw_data = package_functional_facilities(player)
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

            # Helper to convert package_change dicts to ValueChange or None
            def to_value_change(data: dict | None) -> ValueChange | None:
                if data is None:
                    return None
                return ValueChange(current=data.get("current"), upgraded=data.get("upgraded"))

            # Convert warehouse capacities if present
            warehouse_caps = None
            if "warehouse_capacities" in facility_data:
                warehouse_caps = {
                    fuel: to_value_change(change) for fuel, change in facility_data["warehouse_capacities"].items()
                }

            # Create the facility catalog entry
            facilities.append(
                FunctionalFacilityCatalogOut(
                    name=facility_data["name"],
                    description=facility_data["description"],
                    wikipedia_link=facility_data["wikipedia_link"],
                    price=facility_data["price"],
                    construction_power=facility_data["construction_power"],
                    construction_time=facility_data["construction_time"],
                    construction_pollution=facility_data.get("construction_pollution"),
                    requirements=requirements,
                    requirements_status=facility_data["requirements_status"],
                    level=facility_data["level"],
                    average_consumption=to_value_change(facility_data.get("average_consumption")),
                    revenue_generation=to_value_change(facility_data.get("revenue_generation")),
                    lab_workers=to_value_change(facility_data.get("lab_workers")),
                    research_speed_bonus=facility_data.get("research_speed_bonus"),
                    warehouse_capacities=warehouse_caps,
                    power_consumption=to_value_change(facility_data.get("power_consumption")),
                    co2_absorption=to_value_change(facility_data.get("co2_absorption")),
                ),
            )

        return FunctionalFacilityCatalogListOut(functional_facilities=facilities)


class TechnologyCatalogOut(BaseModel):
    """Represents a technology available for research."""

    name: TechnologyType
    description: str
    wikipedia_link: str
    price: float
    construction_power: float
    construction_time: float
    requirements: list[RequirementOut]
    requirements_status: Literal["satisfied", "queued", "unsatisfied"]
    level: int
    affected_facilities: list[str]
    discount: float | None = None
    prevalence: int | None = None
    # Mechanical Engineering specific
    power_generation_bonus: float | None = None
    price_penalty: float | None = None
    # Thermodynamics specific
    fuel_use_reduction_bonus: float | None = None
    co2_emissions_reduction_bonus: float | None = None
    molten_salt_efficiency_bonus: float | None = None
    # Physics specific
    # (same as mechanical engineering, already has power_generation_bonus and price_penalty)
    # Building Technology specific
    construction_time_reduction_bonus: float | None = None
    construction_workers: ValueChange | None = None
    # Mineral Extraction specific
    extraction_speed_bonus: float | None = None
    power_consumption_penalty: float | None = None
    co2_emissions_penalty: float | None = None
    # Transport Technology specific
    shipment_time_reduction_bonus: float | None = None
    power_consumption_reduction_bonus: float | None = None
    # Materials specific
    price_reduction_bonus: float | None = None
    construction_power_reduction_bonus: float | None = None
    # Civil Engineering specific
    storage_capacity_bonus: float | None = None
    # Aerodynamics specific
    # (same as mechanical engineering, already has power_generation_bonus and price_penalty)
    # Chemistry specific
    hydrogen_efficiency_bonus: float | None = None
    lithium_ion_efficiency_bonus: float | None = None
    solid_state_efficiency_bonus: float | None = None
    # Nuclear Engineering specific
    # (same as mechanical engineering, already has power_generation_bonus and price_penalty)


class TechnologyCatalogListOut(BaseModel):
    """List of all technologies available for research."""

    technologies: list[TechnologyCatalogOut]

    @classmethod
    def from_player(cls, player: Player) -> TechnologyCatalogListOut:
        """Create a catalog from the player's current state."""
        raw_data = package_available_technologies(player)
        technologies = []
        for technology_data in raw_data:
            # Convert requirements
            requirements = [
                RequirementOut(
                    name=req["name"],
                    level=req["level"],
                    status=req["status"],
                )
                for req in technology_data["requirements"]
            ]

            # Helper to convert package_change dicts to ValueChange or None
            def to_value_change(data: dict | None) -> ValueChange | None:
                if data is None:
                    return None
                return ValueChange(current=data.get("current"), upgraded=data.get("upgraded"))

            # Create the technology catalog entry
            tech_entry = TechnologyCatalogOut(
                name=technology_data["name"],
                description=technology_data["description"],
                wikipedia_link=technology_data["wikipedia_link"],
                price=technology_data["price"],
                construction_power=technology_data["construction_power"],
                construction_time=technology_data["construction_time"],
                requirements=requirements,
                requirements_status=technology_data["requirements_status"],
                level=technology_data["level"],
                affected_facilities=technology_data["affected_facilities"],
                discount=technology_data.get("discount"),
                prevalence=technology_data.get("prevalence"),
                power_generation_bonus=technology_data.get("power_generation_bonus"),
                price_penalty=technology_data.get("price_penalty"),
                fuel_use_reduction_bonus=technology_data.get("fuel_use_reduction_bonus"),
                co2_emissions_reduction_bonus=technology_data.get("co2_emissions_reduction_bonus"),
                molten_salt_efficiency_bonus=technology_data.get("molten_salt_efficiency_bonus"),
                construction_time_reduction_bonus=technology_data.get("construction_time_reduction_bonus"),
                construction_workers=to_value_change(technology_data.get("construction_workers")),
                extraction_speed_bonus=technology_data.get("extraction_speed_bonus"),
                power_consumption_penalty=technology_data.get("power_consumption_penalty"),
                co2_emissions_penalty=technology_data.get("co2_emissions_penalty"),
                shipment_time_reduction_bonus=technology_data.get("shipment_time_reduction_bonus"),
                power_consumption_reduction_bonus=technology_data.get("power_consumption_reduction_bonus"),
                price_reduction_bonus=technology_data.get("price_reduction_bonus"),
                construction_power_reduction_bonus=technology_data.get("construction_power_reduction_bonus"),
                storage_capacity_bonus=technology_data.get("storage_capacity_bonus"),
                hydrogen_efficiency_bonus=technology_data.get("hydrogen_efficiency_bonus"),
                lithium_ion_efficiency_bonus=technology_data.get("lithium_ion_efficiency_bonus"),
                solid_state_efficiency_bonus=technology_data.get("solid_state_efficiency_bonus"),
            )
            technologies.append(tech_entry)

        return TechnologyCatalogListOut(technologies=technologies)
