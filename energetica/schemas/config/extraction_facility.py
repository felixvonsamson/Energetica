"""ExtractionFacilitiesConfig and ExtractionFacilityConfig classes."""

from pydantic import Field, RootModel
from energetica.schemas.config.operating_facility import OperatingFacilityConfig
from energetica.enums import ExtractionFacilityType


class ExtractionFacilityConfig(OperatingFacilityConfig):
    base_power_consumption: float = Field(
        ge=0.0,
        description="Base power consumption in watts when the facility is operating",
    )
    base_pollution: float = Field(
        ge=0.0,
        description="Base pollution in kg CO2 emitted per kg of resource extracted",
    )
    base_extraction_rate_per_day: float = Field(
        ge=0.0,
        description="Base extraction rate per day as a fraction of the total stock in the ground",
    )


class ExtractionFacilitiesConfig(RootModel[dict[ExtractionFacilityType, ExtractionFacilityConfig]]):
    def __getitem__(self, item: ExtractionFacilityType) -> ExtractionFacilityConfig:
        return self.root[item]
