"""
This code contains the main functions that communicate with the server (server side)
"""

import time
import heapq
from flask import request, session, flash, g, current_app
from flask_login import current_user
from . import heap
from .database import Player, Hex, Under_construction
from .utils import add_asset, display_CHF
from . import db


def add_handlers(socketio, engine):
    # ???
    @socketio.on("give_identity")
    def give_identity():
        player = current_user
        player.sid = request.sid
        db.session.commit()

    # this function is executed when a player choses a tile
    @socketio.on("choose_location")
    def choose_location(id):
        location = Hex.query.get(id + 1)
        if location.player_id != None:
            flash("Location already taken", category="error")  # doesn't work
        else:
            location.player_id = current_user.id
            db.session.commit()
            engine.refresh()

    # this function is executed when a player clicks on 'start construction'
    @socketio.on("start_construction")
    def start_construction(building, family):
        assets = current_app.config["engine"].config[current_user.id]["assets"]
        if current_user.money < assets[building]["price"]:
            flash("Not enough money", category="error")  # doesn't work
        else:
            current_user.money -= assets[building]["price"]
            db.session.commit()
            updates = [("money", display_CHF(current_user.money))]
            engine.update_fields(updates, current_user)
            finish_time = time.time() + assets[building]["construction time"]
            heapq.heappush(heap, (finish_time, add_asset, (current_user.id, building)))
            new_building = Under_construction(
                name=building,
                family=family,
                start_time=time.time(),
                finish_time=finish_time,
                player_id=session["ID"],
            )
            db.session.add(new_building)
            db.session.commit()