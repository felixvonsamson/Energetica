"""LevelProjectConfig class."""

from pydantic import Field
from energetica.schemas.config.base_project import BaseProjectConfig


class LevelProjectConfig(BaseProjectConfig):
    base_construction_energy: float = Field(gt=0.0, description="Base construction energy in Wh")
    price_multiplier: float = Field(gt=1.0, description="Price multiplier per level")
