"""Contains the class that stores the resources shipment on their way."""

from energetica.database import db


class Shipment(db.Model):
    """Class that stores the resources shipment on their way."""

    id = db.Column(db.Integer, primary_key=True)
    resource = db.Column(db.String(10))
    quantity = db.Column(db.Float)  # in kg
    arrival_tick = db.Column(db.Float)  # in game ticks when the shipment will arrive
    duration = db.Column(db.Float)  # in game ticks
    pause_tick = db.Column(db.Integer, default=None)  # time at witch the shipment has been paused if it has
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))  # can access player directly with .player

    def delay_by(self, ticks: float):
        """Delays the shipment by the given number of ticks"""
        self.arrival_tick += ticks

    def is_ongoing(self) -> bool:
        """Returns True if this shipment is not paused"""
        return self.pause_tick is None
