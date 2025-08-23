"""Module that contains the Network class."""

from __future__ import annotations

import pickle
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

    rolling_history: CircularBufferNetwork = field(default_factory=CircularBufferNetwork)
    capacities: CapacityData = field(default_factory=CapacityData)

    def __post_init__(self) -> None:
        super().__post_init__()
        network_path = f"instance/data/networks/{self.id}"
        Path(f"{network_path}/charts").mkdir(parents=True, exist_ok=True)

        self.capacities.update_network(self)
        past_data = {
            "network_data": {
                "price": [[0.0] * 360 for _ in range(5)],
                "quantity": [[0.0] * 360 for _ in range(5)],
            },
            "exports": {},
            "imports": {},
            "generation": {},
            "consumption": {},
        }
        Path(f"{network_path}").mkdir(parents=True, exist_ok=True)
        with open(f"{network_path}/time_series.pck", "wb") as file:
            pickle.dump(past_data, file)

    def delete(self) -> None:
        network_path = f"instance/data/networks/{self.id}"
        shutil.rmtree(network_path)
        super().delete()
