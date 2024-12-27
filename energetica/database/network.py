"""Module that contains the Network class."""

import itertools
from dataclasses import dataclass, field
from typing import ClassVar

from flask import current_app

from energetica.database.engine_data import CapacityData, CircularBufferNetwork
from energetica.database.player import Player


@dataclass
class Network:
    """Class that stores the networks of players."""

    __next_id: ClassVar[int] = itertools.count()
    id: int

    name: str
    members: list[Player]

    rolling_history: CircularBufferNetwork = field(default_factory=CircularBufferNetwork)
    capacities: CapacityData = field(default_factory=CapacityData)

    def __post_init__(self):
        """Post initialization method."""
        self.id = next(Network.__next_id)
        current_app.config["engine"].players[self.id] = self
