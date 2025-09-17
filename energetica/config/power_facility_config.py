"""PowerAssetConfig model for power facility configuration."""

from typing_extensions import Literal
from pydantic import Field, RootModel

from energetica.config.power_producing_facility_config import PowerProducingFacilityConfig
from energetica.enums import Fuel, PowerFacilityType


class PowerFacilityConfig(PowerProducingFacilityConfig):
    consumed_resources: dict[Fuel | Literal["wind", "water", "hydropower", "irradiance"], float] = Field(
        description="Resources consumed by the power facility in kg/MWh",
    )
    base_pollution: float = Field(ge=0.0, description="Base pollution in kg CO2/MWh")


class PowerFacilitiesConfig(RootModel[dict[PowerFacilityType, PowerFacilityConfig]]):
    def __getitem__(self, item: PowerFacilityType) -> PowerFacilityConfig:
        return self.root[item]
