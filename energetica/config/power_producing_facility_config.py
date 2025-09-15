"""WIP."""

from pydantic import Field
from energetica.config.operating_facility_config import OperatingFacilityConfig


class PowerProducingFacilityConfig(OperatingFacilityConfig):
    base_power_generation: float = Field(gt=0.0, description="Base power generation in W")
    ramping_time: float = Field(ge=0.0, description="Ramping time in seconds")
