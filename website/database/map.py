from website import db


class Hex(db.Model):
    """class for the tiles that compose the map"""

    id = db.Column(db.Integer, primary_key=True)
    q = db.Column(db.Integer)
    r = db.Column(db.Integer)
    solar = db.Column(db.Float)
    wind = db.Column(db.Float)
    hydro = db.Column(db.Float)
    coal = db.Column(db.Float)
    oil = db.Column(db.Float)
    gas = db.Column(db.Float)
    uranium = db.Column(db.Float)
    player_id = db.Column(
        db.Integer, db.ForeignKey("player.id"), unique=True, nullable=True
    )  # ID of the owner of the tile

    def __repr__(self):
        return f"<Tile {self.id} wind {self.wind}>"
