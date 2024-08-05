"""This file contains the `Hex` class, which contains resource information, and
which makes up the map"""

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

    def get_neighbors(self, n=1):
        """returns the neighbors of the tile plus the tile itself"""

        def get_hex_at_distance(q, r, distance):
            """Generate all hex coordinates within a given distance"""
            results = []
            for dq in range(-distance, distance + 1):
                for dr in range(max(-distance, -dq - distance), min(distance, -dq + distance) + 1):
                    results.append((q + dq, r + dr))
            return results

        neighbors = []
        tiles_at_distance = get_hex_at_distance(self.q, self.r, n)
        for q, r in tiles_at_distance:
            neighbor = Hex.query.filter_by(q=q, r=r).first()
            if neighbor:
                neighbors.append(neighbor)
        return neighbors

    def get_downstream_tiles(self, n):
        """returns the tiles that are downstream (related to hydro) from the current tile"""
        downstream_tiles = []

        def find_downstream(tile, n):
            if n == 0:
                return
            for neighbor in tile.get_neighbors():
                if neighbor not in downstream_tiles and neighbor.hydro > tile.hydro:
                    downstream_tiles.append(neighbor)
                    find_downstream(neighbor, n - 1)

        find_downstream(self, n)
        return downstream_tiles
