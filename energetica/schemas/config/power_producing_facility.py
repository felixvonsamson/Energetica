"""PowerProducingFacilityConfig class."""

from pydantic import Field
from energetica.schemas.config.operating_facility import OperatingFacilityConfig


class PowerProducingFacilityConfig(OperatingFacilityConfig):
    base_power_generation: float = Field(gt=0.0, description="Base power generation in W")
    ramping_time: float = Field(ge=0.0, description="Ramping time in seconds")
