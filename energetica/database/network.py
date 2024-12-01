"""Module that contains the Network class."""

from dataclasses import dataclass, field
from functools import cached_property

from flask import current_app

from energetica.database import db
from energetica.database.engine_data import CapacityData, CircularBufferNetwork


@dataclass
class NetworkData:
    """Dataclass that stores the network data."""

    rolling_history: CircularBufferNetwork = field(default_factory=CircularBufferNetwork)
    capacities: CapacityData = field(default_factory=CapacityData)


class Network(db.Model):
    """Class that stores the networks of players."""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True)
    members = db.relationship("Player", backref="network")

    @cached_property
    def data(self) -> NetworkData:
        """Cached property that stores the network data."""
        return current_app.config["engine"].data["by_network"][self.id]
