"""Module that contains the Network class."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from energetica.database import DBModel
from energetica.database.engine_data import CapacityData, CircularBufferNetwork

if TYPE_CHECKING:
    from energetica.database.player import Player


@dataclass
class Network(DBModel):
    """Class that stores the networks of players."""

    name: str
    members: list[Player]

    rolling_history: CircularBufferNetwork = field(default_factory=CircularBufferNetwork)
    capacities: CapacityData = field(default_factory=CapacityData)
