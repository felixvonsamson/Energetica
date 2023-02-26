import time
from .database import Player, Under_construction
from . import db

def add_asset(player_id, building):
    player = Player.query.get(int(player_id))
    setattr(player, building, getattr(player, building) + 1)
    Under_construction.query.filter(Under_construction.finish_time<time.time()).delete()
    db.session.commit()

def display_CHF(price):
    return f"{price:,.0f} CHF".replace(",", " ")