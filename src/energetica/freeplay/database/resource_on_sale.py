"""Module that contains the ResourceOnSale class."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from energetica.freeplay.database import DBModel

if TYPE_CHECKING:
    from energetica.enums import Fuel
    from energetica.freeplay.database.player import Player


@dataclass
class ResourceOnSale(DBModel):
    """Class that stores resources currently on sale."""

    resource: Fuel
    quantity: float
    unit_price: float
    player: Player
