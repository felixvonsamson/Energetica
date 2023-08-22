"""
I dumped all small helpful functions here
"""

import time
from .database import Player, Under_construction
from . import db
from flask import current_app
from sqlalchemy import func

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

from .database import Chat

def check_existing_chats(participants):
    # Get the IDs of the participants
    participant_ids = [participant.id for participant in participants]

    # Generate the conditions for participants' IDs and count
    conditions = [Chat.participants.any(id=participant_id) for participant_id in participant_ids]

    # Query the Chat table
    existing_chats = Chat.query.filter(*conditions)
    for chat in existing_chats:
        if len(chat.participants)==len(participants):
            return True
    return False