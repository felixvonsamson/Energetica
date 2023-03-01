import time
from .database import Player, Under_construction
from . import db
from .config import capacity_table
from flask import g

def add_asset(player_id, building):
    player = Player.query.get(int(player_id))
    setattr(player, building, getattr(player, building) + 1)
    capacity_class = capacity_table[building]
    building_data = g.config["assets"][building]
    setattr(player, capacity_class, getattr(player, capacity_class) + building_data["power production"])
    player.emissions += building_data["pollution"]*building_data["power production"] # [kg/h]
    Under_construction.query.filter(Under_construction.finish_time<time.time()).delete()
    db.session.commit()

def display_CHF(price):
    return f"{price:,.0f} CHF".replace(",", " ")