"""Module that contains the ResourceOnSale class."""

from dataclasses import dataclass
from datetime import datetime

from energetica.database import DB


@dataclass
class ResourceOnSale(DB):
    """Class that stores resources currently on sale."""

    resource: str
    quantity: float
    price: float
    creation_date: datetime = None
