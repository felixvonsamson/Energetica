"""Module that contains the ResourceOnSale class."""

from dataclasses import dataclass

# from typing import TYPE_CHECKING
from energetica.database import DBModel

# if TYPE_CHECKING:
from energetica.database.player import Player


@dataclass
class ResourceOnSale(DBModel):
    """Class that stores resources currently on sale."""

    resource: str
    quantity: float
    price: float
    player: Player
