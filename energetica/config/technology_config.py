"""WIP."""

from __future__ import annotations
from typing import Literal

from pydantic import BaseModel, Field
from energetica.config.level_project_config import LevelProjectConfig
from energetica.enums import ProjectType, TechnologyType


class TechnologyConfig(LevelProjectConfig):
    affected_facilities: list[ProjectType] = Field(
        default_factory=list,
        description="List of facilities affected by this technology.",
    )


class PriceModifyingConfig(TechnologyConfig):
    price_factor: float


class PowerModifyingConfig(PriceModifyingConfig):
    prod_factor: float


class CivilEngineeringConfig(PowerModifyingConfig):
    capacity_factor: float


class ThermodynamicsConfig(TechnologyConfig):
    efficiency_factor: float


class BuildingTechConfig(TechnologyConfig):
    time_factor: float


class MineralExtractionConfig(PriceModifyingConfig):
    extract_factor: float
    pollution_factor: float
    energy_factor: float


class TransportTechConfig(TechnologyConfig):
    energy_factor: float
    time_factor: float


class MaterialsConfig(PriceModifyingConfig):
    construction_energy_factor: float


class ChemistryConfig(PriceModifyingConfig):
    inefficiency_factor: float


class TechnologiesConfig(BaseModel):
    mathematics: TechnologyConfig
    mechanical_engineering: PowerModifyingConfig
    thermodynamics: ThermodynamicsConfig
    physics: PowerModifyingConfig
    building_technology: BuildingTechConfig
    mineral_extraction: MineralExtractionConfig
    transport_technology: TransportTechConfig
    materials: MaterialsConfig
    civil_engineering: CivilEngineeringConfig
    aerodynamics: PowerModifyingConfig
    chemistry: ChemistryConfig
    nuclear_engineering: PowerModifyingConfig

    def __getitem__(self, item: TechnologyType) -> TechnologyConfig:
        if item == TechnologyType.MATHEMATICS:
            return self.mathematics
        elif item == TechnologyType.MECHANICAL_ENGINEERING:
            return self.mechanical_engineering
        elif item == TechnologyType.THERMODYNAMICS:
            return self.thermodynamics
        elif item == TechnologyType.PHYSICS:
            return self.physics
        elif item == TechnologyType.BUILDING_TECHNOLOGY:
            return self.building_technology
        elif item == TechnologyType.MINERAL_EXTRACTION:
            return self.mineral_extraction
        elif item == TechnologyType.TRANSPORT_TECHNOLOGY:
            return self.transport_technology
        elif item == TechnologyType.MATERIALS:
            return self.materials
        elif item == TechnologyType.CIVIL_ENGINEERING:
            return self.civil_engineering
        elif item == TechnologyType.AERODYNAMICS:
            return self.aerodynamics
        elif item == TechnologyType.CHEMISTRY:
            return self.chemistry
        elif item == TechnologyType.NUCLEAR_ENGINEERING:
            return self.nuclear_engineering
        else:
            raise ValueError(f"Invalid technology type: {item}")

    def get_price_modifying_technology(
        self,
        project_type: Literal[
            TechnologyType.MECHANICAL_ENGINEERING,
            TechnologyType.PHYSICS,
            TechnologyType.CIVIL_ENGINEERING,
            TechnologyType.AERODYNAMICS,
            TechnologyType.NUCLEAR_ENGINEERING,
            TechnologyType.MINERAL_EXTRACTION,
            TechnologyType.MATERIALS,
            TechnologyType.CHEMISTRY,
        ],
    ) -> PriceModifyingConfig:
        if project_type == TechnologyType.MECHANICAL_ENGINEERING:
            return self.mechanical_engineering
        elif project_type == TechnologyType.PHYSICS:
            return self.physics
        elif project_type == TechnologyType.CIVIL_ENGINEERING:
            return self.civil_engineering
        elif project_type == TechnologyType.AERODYNAMICS:
            return self.aerodynamics
        elif project_type == TechnologyType.NUCLEAR_ENGINEERING:
            return self.nuclear_engineering
        elif project_type == TechnologyType.MINERAL_EXTRACTION:
            return self.mineral_extraction
        elif project_type == TechnologyType.MATERIALS:
            return self.materials
        elif project_type == TechnologyType.CHEMISTRY:
            return self.chemistry
        raise ValueError(f"Invalid facility type: {project_type}")
