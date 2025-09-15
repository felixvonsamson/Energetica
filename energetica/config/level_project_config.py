"""WIP."""

from pydantic import Field
from energetica.config.base_project_config import BaseProjectConfig


class LevelProjectConfig(BaseProjectConfig):
    base_construction_energy: float = Field(gt=0.0, description="Base construction energy in Wh")
    price_multiplier: float = Field(gt=1.0, description="Price multiplier per level")
