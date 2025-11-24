"""Schemas for API for a player."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from energetica.database.player import Player


class PlayerOut(BaseModel):
    """Response model for player information."""

    id: int = Field(description="ID of the player")
    username: str = Field(description="Username of the player")


class SettingsOut(BaseModel):
    """Response model for user configuration."""

    show_disclaimer: bool = Field(description="Whether to show the chat disclaimer or not")


class SettingsPatch(BaseModel):
    """Request model for user configuration."""

    show_disclaimer: bool | None = Field(None, description="Whether to show the chat disclaimer or not")


class MoneyOut(BaseModel):
    """Model for the player's money."""

    money: float

    @classmethod
    def from_player(cls, player: Player) -> MoneyOut:
        return MoneyOut(money=player.money)


class WorkerInfo(BaseModel):
    """Information about a specific worker type."""

    available: int = Field(description="Number of available workers")
    total: int = Field(description="Total number of workers")


class WorkersOut(BaseModel):
    """Model for the player's workers."""

    construction: WorkerInfo = Field(description="Construction workers")
    laboratory: WorkerInfo = Field(description="Laboratory/research workers")

    @classmethod
    def from_player(cls, player: Player) -> WorkersOut:
        from energetica.enums import WorkerType

        return WorkersOut(
            construction=WorkerInfo(
                available=player.available_workers(WorkerType.CONSTRUCTION),
                total=player.workers[WorkerType.CONSTRUCTION],
            ),
            laboratory=WorkerInfo(
                available=player.available_workers(WorkerType.RESEARCH),
                total=player.workers[WorkerType.RESEARCH],
            ),
        )


class ResourceStock(BaseModel):
    """Information about a specific resource stock."""

    stock: float = Field(description="Current stock in kg")
    capacity: float = Field(description="Maximum capacity in kg")
    reserves: float = Field(description="Fuel reserves on the player's tile in kg")


class ResourcesOut(BaseModel):
    """Model for the player's resource stocks."""

    coal: ResourceStock = Field(description="Coal stock")
    gas: ResourceStock = Field(description="Gas stock")
    uranium: ResourceStock = Field(description="Uranium stock")

    @classmethod
    def from_player(cls, player: Player) -> ResourcesOut:
        from energetica.enums import Fuel

        warehouse_capacities = player.config["warehouse_capacities"]

        return ResourcesOut(
            coal=ResourceStock(
                stock=player.resources[Fuel.COAL],
                capacity=warehouse_capacities[Fuel.COAL],
                reserves=player.tile.fuel_reserves[Fuel.COAL],
            ),
            gas=ResourceStock(
                stock=player.resources[Fuel.GAS],
                capacity=warehouse_capacities[Fuel.GAS],
                reserves=player.tile.fuel_reserves[Fuel.GAS],
            ),
            uranium=ResourceStock(
                stock=player.resources[Fuel.URANIUM],
                capacity=warehouse_capacities[Fuel.URANIUM],
                reserves=player.tile.fuel_reserves[Fuel.URANIUM],
            ),
        )


class FunctionalFacilityLevels(BaseModel):
    """Levels of functional facilities."""

    industry: int = Field(description="Industry level")
    laboratory: int = Field(description="Laboratory level")
    warehouse: int = Field(description="Warehouse level")
    carbon_capture: int = Field(description="Carbon capture level")


class TechnologyLevels(BaseModel):
    """Levels of technologies."""

    mathematics: int = Field(description="Mathematics level")
    mechanical_engineering: int = Field(description="Mechanical Engineering level")
    thermodynamics: int = Field(description="Thermodynamics level")
    physics: int = Field(description="Physics level")
    building_technology: int = Field(description="Building Technology level")
    mineral_extraction: int = Field(description="Mineral Extraction level")
    transport_technology: int = Field(description="Transport Technology level")
    materials: int = Field(description="Materials level")
    civil_engineering: int = Field(description="Civil Engineering level")
    aerodynamics: int = Field(description="Aerodynamics level")
    chemistry: int = Field(description="Chemistry level")
    nuclear_engineering: int = Field(description="Nuclear Engineering level")


class ProgressionMetrics(BaseModel):
    """Player progression metrics and statistics."""

    average_revenues: float = Field(description="Average revenues per hour")
    max_power_consumption: float = Field(description="Maximum power consumption in W")
    max_energy_stored: float = Field(description="Maximum energy stored in J")
    imported_energy: float = Field(description="Total imported energy in J")
    exported_energy: float = Field(description="Total exported energy in J")
    extracted_resources: float = Field(description="Total extracted resources in kg")
    bought_resources: float = Field(description="Total bought resources in kg")
    sold_resources: float = Field(description="Total sold resources in kg")
    total_technologies: int = Field(description="Total number of technologies researched")
    xp: float = Field(description="Player experience points")
    captured_co2: float = Field(description="Total captured CO2 in kg")
    net_emissions: float = Field(description="Net CO2 emissions in kg")


class ProfileOut(BaseModel):
    """Complete player profile information."""

    username: str = Field(description="Player username")
    network_name: str | None = Field(None, description="Network name if player is in a network")
    functional_facility_lvl: FunctionalFacilityLevels = Field(description="Functional facility levels")
    technology_lvl: TechnologyLevels = Field(description="Technology levels")
    progression_metrics: ProgressionMetrics = Field(description="Progression metrics and statistics")

    @classmethod
    def from_player(cls, player: Player) -> ProfileOut:
        from energetica.enums import FunctionalFacilityType, TechnologyType

        # Get functional facility levels
        functional_facility_lvl = FunctionalFacilityLevels(
            industry=player.functional_facility_lvl[FunctionalFacilityType.INDUSTRY],
            laboratory=player.functional_facility_lvl[FunctionalFacilityType.LABORATORY],
            warehouse=player.functional_facility_lvl[FunctionalFacilityType.WAREHOUSE],
            carbon_capture=player.functional_facility_lvl[FunctionalFacilityType.CARBON_CAPTURE],
        )

        # Get technology levels
        technology_lvl = TechnologyLevels(
            mathematics=player.technology_lvl[TechnologyType.MATHEMATICS],
            mechanical_engineering=player.technology_lvl[TechnologyType.MECHANICAL_ENGINEERING],
            thermodynamics=player.technology_lvl[TechnologyType.THERMODYNAMICS],
            physics=player.technology_lvl[TechnologyType.PHYSICS],
            building_technology=player.technology_lvl[TechnologyType.BUILDING_TECHNOLOGY],
            mineral_extraction=player.technology_lvl[TechnologyType.MINERAL_EXTRACTION],
            transport_technology=player.technology_lvl[TechnologyType.TRANSPORT_TECHNOLOGY],
            materials=player.technology_lvl[TechnologyType.MATERIALS],
            civil_engineering=player.technology_lvl[TechnologyType.CIVIL_ENGINEERING],
            aerodynamics=player.technology_lvl[TechnologyType.AERODYNAMICS],
            chemistry=player.technology_lvl[TechnologyType.CHEMISTRY],
            nuclear_engineering=player.technology_lvl[TechnologyType.NUCLEAR_ENGINEERING],
        )

        # Get progression metrics
        metrics = player.progression_metrics

        # Always include emissions data (frontend will hide based on capabilities)
        progression_metrics = ProgressionMetrics(
            average_revenues=metrics.get("average_revenues", 0),
            max_power_consumption=metrics.get("max_power_consumption", 0),
            max_energy_stored=metrics.get("max_energy_stored", 0),
            imported_energy=metrics.get("imported_energy", 0),
            exported_energy=metrics.get("exported_energy", 0),
            extracted_resources=metrics.get("extracted_resources", 0),
            bought_resources=metrics.get("bought_resources", 0),
            sold_resources=metrics.get("sold_resources", 0),
            total_technologies=int(metrics.get("total_technologies", 0)),
            xp=metrics.get("xp", 0),
            captured_co2=metrics.get("captured_co2", 0),
            net_emissions=player.calculate_net_emissions(),
        )

        return ProfileOut(
            username=player.username,
            network_name=player.network.name if player.network else None,
            functional_facility_lvl=functional_facility_lvl,
            technology_lvl=technology_lvl,
            progression_metrics=progression_metrics,
        )
