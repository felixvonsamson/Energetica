"""Module that contains the ResourceOnSale class."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from energetica.database import DBModel

if TYPE_CHECKING:
    from energetica.database.player import Player
    from energetica.enums import Fuel


@dataclass
class ResourceOnSale(DBModel):
    """Class that stores resources currently on sale."""

    resource: Fuel
    quantity: float
    price: float
    player: Player
