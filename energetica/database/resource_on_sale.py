"""Module that contains the ResourceOnSale class."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from energetica.database import DBModel
from energetica.schemas.resource_market import AskOut

if TYPE_CHECKING:
    from energetica.database.player import Player
    from energetica.enums import Fuel


@dataclass
class ResourceOnSale(DBModel):
    """Class that stores resources currently on sale."""

    resource: Fuel
    quantity: float
    unit_price: float
    player: Player

    def to_schema(self) -> AskOut:
        """Convert the ResourceOnSale object to a schema."""
        return AskOut(
            id=self.id,
            resource_type=self.resource,
            unit_price=self.unit_price,
            quantity=self.quantity,
        )
