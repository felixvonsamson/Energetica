"""Module that contains the Network class."""

from __future__ import annotations

import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

from energetica.database import DBModel
from energetica.database.engine_data.capacity_data import CapacityData
from energetica.database.engine_data.circular_buffer_network import CircularBufferNetwork

if TYPE_CHECKING:
    from energetica.database.player import Player


@dataclass
class Network(DBModel):
    """Class that stores the networks of players."""

    name: str
    members: list[Player]
    created_tick: int = field(default=0)

    rolling_history: CircularBufferNetwork = field(default_factory=CircularBufferNetwork)
    capacities: CapacityData = field(default_factory=CapacityData)

    def __post_init__(self) -> None:
        super().__post_init__()
        network_path = f"instance/data/networks/{self.id}"
        Path(f"{network_path}/charts").mkdir(parents=True, exist_ok=True)

        self.capacities.update_network(self)

    def __setstate__(self, state: dict) -> None:
        """Called when unpickling - handle backward compatibility for new fields."""
        # Restore the object's state
        self.__dict__.update(state)

        # Backward compatibility: Initialize created_tick for old Network objects loaded from pickle
        if not hasattr(self, "created_tick"):
            self.created_tick = 0

    def delete(self) -> None:
        network_path = f"instance/data/networks/{self.id}"
        shutil.rmtree(network_path)
        super().delete()
