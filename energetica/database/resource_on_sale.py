"""Module that contains the ResourceOnSale class."""

from dataclasses import dataclass
from datetime import datetime

from energetica.database import DBModel


@dataclass
class ResourceOnSale(DBModel):
    """Class that stores resources currently on sale."""

    resource: str
    quantity: float
    price: float
