"""Schemas for API for the leaderboards."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from pydantic import BaseModel

from energetica.database.player import Player

if TYPE_CHECKING:
    from energetica.database.player import Player


class LeaderboardsOut(BaseModel):
    rows: list[PlayerDetailStats]


class GeneralStats(BaseModel):
    network_name: Optional[str]
    max_power_consumption: float
    operating_income: float
    xp: float
    total_technologies: int
    total_projects: int


class PowerAndEnergyStats(BaseModel):
    max_power_consumption: float
    max_energy_stored: float
    imported_energy: float
    exported_energy: float


class ResourceStats(BaseModel):
    extracted_resources: float
    bought_resources: float
    sold_resources: float


class TechnologiesStats(BaseModel):
    total_technologies: int
    mathematics: int
    mechanical_engineering: int
    thermodynamics: int
    physics: int
    building_technology: int
    mineral_extraction: int
    transport_technology: int
    materials: int
    civil_engineering: int
    aerodynamics: int
    chemistry: int
    nuclear_engineering: int


class FunctionalFacilitiesStats(BaseModel):
    industry: int
    laboratory: int
    warehouse: int
    carbon_capture: int


class EmissionsStats(BaseModel):
    net_emissions: float
    captured_co2: float


class PlayerDetailStats(BaseModel):
    player_id: int
    username: str
    general: GeneralStats
    power_and_energy: PowerAndEnergyStats
    resources: ResourceStats
    technologies: TechnologiesStats
    functional_facilities: FunctionalFacilitiesStats
    emissions: Optional[EmissionsStats] = None

    @classmethod
    def from_player(cls, player: Player, include_emissions: bool) -> PlayerDetailStats:
        from energetica.enums import FunctionalFacilityType, TechnologyType

        metrics = player.progression_metrics

        general = GeneralStats(
            network_name=player.network.name if player.network else None,
            max_power_consumption=metrics.get("max_power_consumption", 0),
            operating_income=metrics.get("operating_income", 0),
            xp=metrics.get("xp", 0),
            total_technologies=int(metrics.get("total_technologies", 0)),
            total_projects=int(metrics.get("total_projects", 0)),
        )

        power_and_energy = PowerAndEnergyStats(
            max_power_consumption=metrics.get("max_power_consumption", 0),
            max_energy_stored=metrics.get("max_energy_stored", 0),
            imported_energy=metrics.get("imported_energy", 0),
            exported_energy=metrics.get("exported_energy", 0),
        )

        resources = ResourceStats(
            extracted_resources=metrics.get("extracted_resources", 0),
            bought_resources=metrics.get("bought_resources", 0),
            sold_resources=metrics.get("sold_resources", 0),
        )

        technologies = TechnologiesStats(
            total_technologies=int(metrics.get("total_technologies", 0)),
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

        functional_facilities = FunctionalFacilitiesStats(
            industry=player.functional_facility_lvl[FunctionalFacilityType.INDUSTRY],
            laboratory=player.functional_facility_lvl[FunctionalFacilityType.LABORATORY],
            warehouse=player.functional_facility_lvl[FunctionalFacilityType.WAREHOUSE],
            carbon_capture=player.functional_facility_lvl[FunctionalFacilityType.CARBON_CAPTURE],
        )

        emissions = None
        if include_emissions:
            emissions = EmissionsStats(
                net_emissions=player.calculate_net_emissions(),
                captured_co2=metrics.get("captured_co2", 0),
            )

        return PlayerDetailStats(
            player_id=player.id,
            username=player.username,
            general=general,
            power_and_energy=power_and_energy,
            resources=resources,
            technologies=technologies,
            functional_facilities=functional_facilities,
            emissions=emissions,
        )
