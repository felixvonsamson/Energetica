"""WIP."""

from pydantic import Field, RootModel

from energetica.config.power_producing_facility_config import PowerProducingFacilityConfig
from energetica.enums import StorageFacilityType


class StorageFacilityConfig(PowerProducingFacilityConfig):
    base_storage_capacity: float = Field(gt=1.0, description="Base storage capacity in Wh")
    base_efficiency: float = Field(gt=0.0, lt=1.0, description="Base efficiency as a fraction")


class StorageFacilitiesConfig(RootModel[dict[StorageFacilityType, StorageFacilityConfig]]):
    def __getitem__(self, item: StorageFacilityType) -> StorageFacilityConfig:
        return self.root[item]
