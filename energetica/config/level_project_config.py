"""WIP."""

from pydantic import Field
from energetica.config.base_project_config import BaseProjectConfig


class LevelProjectConfig(BaseProjectConfig):
    base_construction_energy: float = Field(description="Base construction energy in Wh")
    price_multiplier: float = Field(description="Price multiplier per level")
