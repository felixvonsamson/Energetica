"""
I dumped all small helpful functions here
"""

import time
from .database import Player, Under_construction
from . import db
from flask import current_app

# this function is executed after an asset is finished building :
def add_asset(player_id, building):
    player = Player.query.get(int(player_id))
    assets = current_app.config["engine"].config[player_id]["assets"]
    setattr(player, building, getattr(player, building) + 1)
    building_data = assets[building]
    player.emissions += (
        building_data["pollution"] * building_data["power production"]
    )  # [kg/h]  -> NOT CORRECT, EMISSIONS ONLY WHEN BUILDING IS PRODUCING
    Under_construction.query.filter(
        Under_construction.finish_time < time.time()
    ).delete()
    db.session.commit()

# format for price display
def display_CHF(price):
    return f"{price:,.0f} CHF".replace(",", " ")
