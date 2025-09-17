"""OperatingFacilityConfig class."""

from pydantic import Field
from energetica.config.base_project_config import BaseProjectConfig


class OperatingFacilityConfig(BaseProjectConfig):
    lifespan: float = Field(description="Lifespan in seconds")
    o_and_m_factor_per_day: float = Field(
        gt=0.0,
        description="O&M cost as a fraction of price per in-game day",
        validation_alias="O&M_factor_per_day",
    )
    construction_power_factor: float = Field(
        gt=0.0,
        description="Construction power factor, as fraction of power generation / consumption",
    )

    class Config:
        allow_population_by_field_name = True
        populate_by_name = True
