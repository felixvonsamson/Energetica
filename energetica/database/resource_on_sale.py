"""Module that contains the ResourceOnSale class."""

import itertools
from dataclasses import dataclass
from datetime import datetime
from typing import ClassVar

from flask import current_app


@dataclass
class ResourceOnSale:
    """Class that stores resources currently on sale."""

    __next_id: ClassVar[int] = itertools.count()
    id: int

    resource: str
    quantity: float
    price: float
    creation_date: datetime = None

    def __post_init__(self):
        """Post initialization method."""
        self.id = next(ResourceOnSale.__next_id)
        self.creation_date = datetime.now()
        current_app.config["engine"].players[self.id] = self
