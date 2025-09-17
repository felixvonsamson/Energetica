"""FunctionalFacilitiesConfig and all other related classes."""

from __future__ import annotations

from pydantic import BaseModel, Field
from energetica.schemas.config.level_project import LevelProjectConfig
from energetica.enums import Fuel, FunctionalFacilityType


class FunctionalFacilitiesConfig(BaseModel):
    industry: IndustryConfig
    laboratory: LaboratoryConfig
    warehouse: WarehouseConfig
    carbon_capture: CarbonCaptureConfig

    def __getitem__(self, item: FunctionalFacilityType) -> FunctionalFacilityConfig:
        return getattr(self, item.value)


class FunctionalFacilityConfig(LevelProjectConfig):
    pass


class IndustryConfig(FunctionalFacilityConfig):
    base_power_consumption: float = Field(ge=0.0, description="Base power consumption in W")
    base_income_per_day: float = Field(ge=0.0, description="Base income per in-game day in ¤")
    universal_income_per_day: float = Field(ge=0.0, description="Universal base income per in-game day in ¤")
    power_factor: float = Field(gt=1.0, description="Power consumption multiplier for every level upgrade")
    income_factor: float = Field(description="Income multiplier for every level upgrade")


class LaboratoryConfig(FunctionalFacilityConfig):
    time_factor: float = Field(
        ...,
        gt=0.0,
        lt=1.0,
        description="Multiplier that decreases research time for each lab level.",
    )


class WarehouseConfig(FunctionalFacilityConfig):
    capacities: dict[Fuel, float] = Field(description="Storage capacities for different resources")
    capacity_factor: float = Field(
        gt=1.0,
        description="Multiplier that increases storage capacity for every level upgrade",
    )
    time_per_tile: float = Field(gt=1.0, description="Time to transport goods per tile in in-game seconds")
    energy_per_kg_per_tile: float = Field(
        gt=1.0,
        description="Energy to transport goods per kg and tile in Wh/kg/tile",
    )


class CarbonCaptureConfig(FunctionalFacilityConfig):
    base_power_consumption: float = Field(gt=1.0, description="Base power consumption in W")
    base_absorption_per_day: float = Field(
        gt=0.0,
        description="Base CO2 absorption per in-game day as a fraction of atmospheric CO2",
    )
    power_factor: float = Field(gt=1.0, description="Power consumption multiplier for each level upgrade")
    absorption_factor: float = Field(gt=1.0, description="CO2 absorption multiplier for each level upgrade")
