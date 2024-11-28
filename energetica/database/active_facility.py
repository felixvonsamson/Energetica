from energetica.database import db


class ActiveFacility(db.Model):
    """Class that stores the facilities on the server and their end of life time."""

    id = db.Column(db.Integer, primary_key=True)
    facility = db.Column(db.String(50))
    pos_x = db.Column(db.Float)
    pos_y = db.Column(db.Float)
    # time at witch the facility will be decommissioned
    end_of_life = db.Column(db.Integer)
    # multiply the base values by the following values
    price_multiplier = db.Column(db.Float)
    multiplier_1 = db.Column(db.Float)
    multiplier_2 = db.Column(db.Float)
    multiplier_3 = db.Column(db.Float)
    # percentage of the facility that is currently used
    usage = db.Column(db.Float, default=0)

    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))
