from energetica import db


class ClimateEventRecovery(db.Model):
    """Class that stores the climate events players are recovering from"""

    id = db.Column(db.Integer, primary_key=True)
    event = db.Column(db.String(20))
    start_time = db.Column(db.Integer)
    duration = db.Column(db.Integer)
    recovery_cost = db.Column(db.Float)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))  # can access player directly with .player
