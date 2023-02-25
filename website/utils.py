from flask import current_app
from .database import Player
from . import db

def add_asset(player_id, building):
    player = Player.query.get(int(player_id))
    player.steam_engine += 1
    db.session.commit()
