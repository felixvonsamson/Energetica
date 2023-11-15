"""
Here is the logic for the engine of the game
"""

import datetime
import pickle
import secrets
import logging
import os
import copy
from flask import url_for
from . import heap
import time
import heapq
from .database import Player

from .config import config, wind_power_curve, river_discharge

from .utils import update_weather, save_past_data_threaded

# This is the engine object
class gameEngine(object):
    def __init__(engine):
        engine.config = config
        engine.socketio = None
        engine.logger = logging.getLogger("Energetica") # Not sure what that is 
        engine.init_logger()
        engine.nonces = set() # Dont remember what that is
        engine.log("engine created")

        engine.storage_plants = [
            "small_pumped_hydro",
            "compressed_air",
            "molten_salt",
            "large_pumped_hydro",
            "hydrogen_storage",
            "lithium_ion_batteries",
            "solid_state_batteries"
        ]

        engine.wind_power_curve = wind_power_curve
        engine.river_discharge = river_discharge

        engine.data = {}
        # All data for the current day will be stored here :
        engine.data["current_data"] = {}
        engine.data["current_windspeed"] = [0] * 1441 # daily windspeed in km/h
        engine.data["current_irradiation"] = [0] * 1441 # daily irradiation in W/m2
        engine.data["current_discharge"] = [0] * 1441 # daily river discharge rate factor
        engine.data["current_CO2"] = [0] * 1441
        engine.data["total_t"] = 0
        now = datetime.datetime.today().time()
        engine.data["current_t"] = now.hour * 60 + now.minute + 1 # +1 bc fist value of current day has to be last value of last day
        engine.data["start_date"] = datetime.datetime.today() # 0 point of server time

        with open("website/static/data/industry_demand.pck", "rb") as file:
            engine.industry_demand = pickle.load(file) # array of length 1440 of normalized daily industry demand variations
        with open("website/static/data/industry_demand_year.pck", "rb") as file:
            engine.industry_seasonal = pickle.load(file) # array of length 51 of normalized yearly industry demand variations

        update_weather(engine)

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

# function that is executed once every 24 hours :
def daily_update(engine, app):
    engine.data["current_t"] = 1
    with app.app_context():
        players = Player.query.all()
        past_data = copy.deepcopy(engine.data["current_data"])
        engine.data["current_windspeed"] = [engine.data["current_windspeed"][-1]] + [0]*1440
        engine.data["current_irradiation"] = [engine.data["current_irradiation"][-1]] + [0]*1440
        engine.data["current_discharge"] = [engine.data["current_discharge"][-1]] + [0]*1440
        engine.data["current_CO2"] = [engine.data["current_CO2"][-1]] + [0]*1440
        for player in players:
            for category in engine.data["current_data"][player.username]:
                for element in engine.data["current_data"][player.username][category]:
                    past_data[player.username][category][element].pop(0)
                    data_array = engine.data["current_data"][player.username][category][element]
                    last_value = data_array[-1]
                    data_array.clear()
                    data_array.extend([last_value] + [0]*1440)
             
    save_past_data_threaded(app, past_data)


from .production_update import update_ressources, update_electricity

# function that is executed once every 1 hour :
def state_update_h(engine, app):
    with app.app_context():
        players = Player.query.all()
        for player in players:
            engine.config.update_resource_extraction(player.id) # update mining productivity every hour

# function that is executed once every 1 minute :
def state_update_m(engine, app):
    total_t = (datetime.datetime.now() - engine.data["start_date"]).total_seconds()/60.0
    while(engine.data["total_t"] < total_t):
        engine.data["current_t"] += 1
        # print(f"t = {engine.data['current_t']}")
        engine.data["total_t"] += 1
        if engine.data["current_t"] > 1440:
            daily_update(engine, app)
        with app.app_context():
            if engine.data["current_t"] % 10 == 1:
                update_weather(engine)
            update_ressources(engine)
            update_electricity(engine)
    
        with open("instance/engine_data.pck", "wb") as file:
            pickle.dump(engine.data, file)

# function that is executed once every 1 second :
def check_heap(engine, app):
    # check if there is something planned of this second and call the function if there is
    while heap and heap[0][0] < time.time():
        _, function, args = heapq.heappop(heap)
        with app.app_context():
            function(*args)