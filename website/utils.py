from .database import Player
from . import db

def add_asset(player_id, building):
    player = Player.query.get(int(player_id))
    setattr(player, building, getattr(player, building) + 1)
    db.session.commit()
