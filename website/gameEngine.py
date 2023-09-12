"""
Here is the logic for the engine of the game
"""

import datetime
import pickle
import secrets
import logging
from flask import url_for
from . import heap
import time
import heapq
from .database import Player

from .config import config

# This is the engine object
class gameEngine(object):
    def __init__(engine):
        engine.config = config
        engine.socketio = None
        engine.logger = logging.getLogger("Energetica") # Not sure what that is 
        engine.init_logger()
        engine.logs = [] # Dont think that this is still necessary
        engine.nonces = set() # Dont remember what that is
        engine.log("engine created")

    def init_logger(engine):
        engine.logger.setLevel(logging.INFO)
        s_handler = logging.StreamHandler()
        s_handler.setLevel(logging.INFO)
        engine.logger.addHandler(s_handler)

    def get_nonce(engine):
        while True:
            nonce = secrets.token_hex(16)
            if nonce not in engine.nonces:
                return nonce

    def use_nonce(engine, nonce):
        if nonce in engine.nonces:
            return False
        engine.nonces.add(nonce)
        return True

    # reload page
    def refresh(engine):
        engine.socketio.emit("refresh")

    # change specific field of the page withour reloading
    def update_fields(engine, updates, players=None):
        if players:
            for player in players:
                if player.sid:
                    player.emit("update_data", updates)
        else:
            engine.socketio.emit("update_data", updates, broadcast=True)

    def display_new_message(engine, msg, players=None):
        if players:
            for player in players:
                if player.sid:
                    engine.socketio.emit("display_new_message", msg, room=player.sid)

    # logs a message with the current time in the terminal and stores it in 'logs'
    def log(engine, message):
        log_message = datetime.datetime.now().strftime("%H:%M:%S : ") + message
        engine.logger.info(log_message)
        engine.logs.append(log_message)


from .utils import add_asset

# function that is executed once every 24 hours :
def daily_update(engine, app):
    # recalculate industry demand IMPLEMENT CHANGING DATA
    with app.app_context():
        with open("website/static/data/industry_demand.pck", "rb") as file:
            industry_demand = pickle.load(file)
        players = Player.query.all()
        for player in players:
            player.todays_production["demand"]["industriy"] = [
                i * 50000 for i in industry_demand
            ]


from .production_update import update_ressources, update_electricity

# function that is executed once every 1 hour :
def state_update_h(engine, app):
    with app.app_context():
        update_ressources(engine)

# function that is executed once every 1 minute :
def state_update_m(engine, app):
    with app.app_context():
        update_electricity(engine)

# function that is executed once every 1 second :
def check_heap(engine, app):
    # check if there is something planned of this second and call the function if there is
    while heap and heap[0][0] < time.time():
        _, function, args = heapq.heappop(heap)
        with app.app_context():
            function(*args)