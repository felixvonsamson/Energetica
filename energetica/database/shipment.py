"""Contains the class that stores the resources shipment on their way."""

from dataclasses import dataclass
from functools import cached_property

from flask import current_app

from energetica.database import db


@dataclass
class ShipmentData:
    """Dataclass that stores the data of shipments."""

    speed: float = 1
    previous_speed: float = 1


class Shipment(db.Model):
    """Class that stores the resources shipment on their way."""

    id = db.Column(db.Integer, primary_key=True)
    resource = db.Column(db.String(10))
    quantity = db.Column(db.Float)  # in kg
    arrival_tick = db.Column(db.Float)  # in game ticks when the shipment will arrive
    duration = db.Column(db.Float)  # in game ticks
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))  # can access player directly with .player

    @cached_property
    def data(self) -> ShipmentData:
        """Return the data of the shipment."""
        return current_app.config["engine"].data["by_shipment"][self.id]

    def delay_by(self, ticks: float):
        """Delays the shipment by the given number of ticks"""
        self.arrival_tick += ticks
        self.data.speed = 1 - ticks

    def updated_speed(self) -> float | None:
        """Returns the speed of the shipment except if it is 1 and unchanged since last tick"""
        if self.data.speed != self.data.previous_speed or self.data.speed != 1:
            return self.data.speed
        return None

    def reset_speed(self):
        """Resets the speed of the shipment to 1 and stores the previous speed"""
        self.data.previous_speed = self.data.speed
        self.data.speed = 1
