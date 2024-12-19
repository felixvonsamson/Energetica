from energetica.database import db


class ClimateEventRecovery(db.Model):
    """Class that stores the climate events players are recovering from"""

    id = db.Column(db.Integer, primary_key=True)
    event = db.Column(db.String(20))
    end_tick = db.Column(db.Float)
    duration = db.Column(db.Float)
    recovery_cost = db.Column(db.Float)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))  # can access player directly with .player
