"""Contains the class that stores the resources shipment on their way."""

import itertools
from dataclasses import dataclass
from typing import ClassVar

from flask import current_app


@dataclass
class Shipment:
    """Class that stores the resources shipment on their way."""

    __next_id: ClassVar[int] = itertools.count()
    id: int

    resource: str
    quantity: float
    arrival_tick: float  # in game ticks when the shipment will arrive
    duration: float  # in game ticks

    speed: float = 1
    previous_speed: float = 1

    def __post_init__(self):
        """Post initialization method."""
        self.id = next(Shipment.__next_id)
        current_app.config["engine"].players[self.id] = self

    def delay_by(self, ticks: float):
        """Delays the shipment by the given number of ticks"""
        self.arrival_tick += ticks
        self.speed = 1 - ticks

    def updated_speed(self) -> float | None:
        """Returns the speed of the shipment except if it is 1 and unchanged since last tick"""
        if self.speed != self.previous_speed or self.speed != 1:
            return self.speed
        return None

    def reset_speed(self):
        """Resets the speed of the shipment to 1 and stores the previous speed"""
        self.previous_speed = self.speed
        self.speed = 1
