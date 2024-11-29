from energetica.database import db


class Shipment(db.Model):
    """Class that stores the resources shipment on their way"""

    id = db.Column(db.Integer, primary_key=True)
    resource = db.Column(db.String(10))
    quantity = db.Column(db.Float)
    departure_time = db.Column(db.Integer)
    duration = db.Column(db.Integer)
    suspension_time = db.Column(db.Integer, default=None)  # time at witch the shipment has been paused if it has
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))  # can access player directly with .player
