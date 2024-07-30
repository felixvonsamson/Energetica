"""Here is the logic for the engine of the game"""

import json
import logging
import math
import pickle
import time
from collections import defaultdict
from datetime import datetime

import website.production_update as production_update
import website.utils as utils

from . import db
from .config import config, const_config
from .database.engine_data import EmissionData, WeatherData
from .database.player_assets import (
    ActiveFacilities,
    Shipment,
    UnderConstruction,
)


# This is the engine object
class GameEngine(object):
    """This class is the engine of the game. It contains all the data and methods to run the game."""

    def __init__(self, clock_time, in_game_seconds_per_tick):
        self.clock_time = clock_time
        self.in_game_seconds_per_tick = in_game_seconds_per_tick
        self.config = config
        self.const_config = const_config
        self.socketio = None
        self.notification_subscriptions = defaultdict(list)
        self.clients = defaultdict(list)
        self.websocket_dict = {}
        self.console_logger = logging.getLogger("console")  # logs events in the terminal
        self.action_logger = logging.getLogger("action_history")  # logs all called functions to a file
        self.init_loggers()
        self.log("engine created")

        self.power_facilities = [
            "steam_engine",
            "windmill",
            "watermill",
            "coal_burner",
            "oil_burner",
            "gas_burner",
            "small_water_dam",
            "onshore_wind_turbine",
            "combined_cycle",
            "nuclear_reactor",
            "large_water_dam",
            "CSP_solar",
            "PV_solar",
            "offshore_wind_turbine",
            "nuclear_reactor_gen4",
        ]

        self.extraction_facilities = [
            "coal_mine",
            "oil_field",
            "gas_drilling_site",
            "uranium_mine",
        ]

        self.extractable_resources = ["coal", "oil", "gas", "uranium"]
        self.storage_facilities = [
            "small_pumped_hydro",
            "compressed_air",
            "molten_salt",
            "large_pumped_hydro",
            "hydrogen_storage",
            "lithium_ion_batteries",
            "solid_state_batteries",
        ]

        self.controllable_facilities = [
            "steam_engine",
            "nuclear_reactor",
            "nuclear_reactor_gen4",
            "combined_cycle",
            "gas_burner",
            "oil_burner",
            "coal_burner",
        ]

        self.renewables = [
            "small_water_dam",
            "large_water_dam",
            "watermill",
            "onshore_wind_turbine",
            "offshore_wind_turbine",
            "windmill",
            "CSP_solar",
            "PV_solar",
        ]

        self.functional_facilities = [
            "industry",
            "laboratory",
            "warehouse",
            "carbon_capture",
        ]

        self.technologies = [
            "mathematics",
            "mechanical_engineering",
            "thermodynamics",
            "physics",
            "building_technology",
            "mineral_extraction",
            "transport_technology",
            "materials",
            "civil_engineering",
            "aerodynamics",
            "chemistry",
            "nuclear_engineering",
        ]

        self.data = {}
        # All data for the current day will be stored here :
        self.data["player_capacities"] = {}
        self.data["network_capacities"] = {}
        self.data["current_data"] = {}
        self.data["network_data"] = {}
        self.data["weather"] = WeatherData()
        self.data["emissions"] = EmissionData()
        self.data["total_t"] = 0  # Number of simulated game ticks since server start
        self.data["start_date"] = datetime.now()  # 0 point of server time
        last_midnight = self.data["start_date"].replace(hour=0, minute=0, second=0, microsecond=0)
        # time shift for daily industry variation
        self.data["delta_t"] = round((self.data["start_date"] - last_midnight).total_seconds() // self.clock_time)
        # transform start_date to a seconds timestamp corresponding to the time of the first tick
        self.data["start_date"] = math.floor(self.data["start_date"].timestamp() / clock_time) * clock_time

        # stored the levels of technology of the server
        # for each tech an array stores [# players with lvl 1, # players with lvl 2, ...]
        self.data["technology_lvls"] = {
            "mathematics": [0],
            "mechanical_engineering": [0],
            "thermodynamics": [0],
            "physics": [0],
            "building_technology": [0],
            "mineral_extraction": [0],
            "transport_technology": [0],
            "materials": [0],
            "civil_engineering": [0],
            "aerodynamics": [0],
            "chemistry": [0],
            "nuclear_engineering": [0],
        }

        with open("website/static/data/industry_demand.pck", "rb") as file:
            self.industry_demand = pickle.load(
                file
            )  # array of length 1440 of normalized daily industry demand variations
        with open("website/static/data/industry_demand_year.pck", "rb") as file:
            self.industry_seasonal = pickle.load(
                file
            )  # array of length 51 of normalized yearly industry demand variations

        self.data["weather"].update_weather(self)

    def init_loggers(self):
        """Initializes the loggers for the engine"""
        self.console_logger.setLevel(logging.INFO)
        s_handler = logging.StreamHandler()
        s_handler.setLevel(logging.INFO)
        console_format = logging.Formatter("%(asctime)s : %(message)s", datefmt="%H:%M:%S")
        s_handler.setFormatter(console_format)
        self.console_logger.addHandler(s_handler)

        self.action_logger.setLevel(logging.INFO)
        f_handler = logging.FileHandler("instance/actions_history.log")
        f_handler.setLevel(logging.INFO)
        self.action_logger.addHandler(f_handler)

    def refresh(self):
        """Sends a refresh signal to all clients"""
        # TODO: Do we need this method?
        self.socketio.emit("refresh")

    def display_new_message(self, message, chat):
        """Sends chat message to all relevant sources through socketio and websocket"""
        from website.api import websocket

        websocket_message = websocket.rest_new_chat_message(chat.id, message)
        for player in chat.participants:
            player.emit(
                "display_new_message",
                {
                    "time": message.time.isoformat(),
                    "player_id": message.player_id,
                    "text": message.text,
                    "chat_id": message.chat_id,
                },
            )
            websocket.rest_notify_player(self, player, websocket_message)

    # logs a message with the current time in the terminal
    def log(self, message):
        self.console_logger.info(message)

    def warn(self, message):
        self.console_logger.warning(message)

    def package_global_data(self):
        """This method packages mutable global engine data as a dict to be sent and used on the frontend"""
        return {
            "first_tick_date": self.data["start_date"],
            "tick_length": self.clock_time,
            "total_ticks": self.data["total_t"],
            "co2_emissions": self.data["emissions"]["CO2"],
        }


def state_update(engine, app):
    """This function is called every tick to update the state of the game"""
    total_t = (time.time() - engine.data["start_date"]) / engine.clock_time
    while engine.data["total_t"] < total_t - 1:
        engine.data["total_t"] += 1
        engine.log(f"t = {engine.data['total_t']}")
        if engine.data["total_t"] % 216 == 0:
            utils.save_past_data_threaded(app, engine)
        with app.app_context():
            if engine.data["total_t"] % (600 / engine.clock_time) == 0:
                engine.data["weather"].update_weather(engine)
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "endpoint": "update_electricity",
                "total_t": engine.data["total_t"],
            }
            engine.action_logger.info(json.dumps(log_entry))
            production_update.update_electricity(engine=engine)
            check_finished_constructions(engine)

    # save engine every minute in case of server crash
    if engine.data["total_t"] % (60 / engine.clock_time) == 0:
        with open("instance/engine_data.pck", "wb") as file:
            pickle.dump(engine.data, file)
    with app.app_context():
        # TODO: perhaps only run the below code conditionally on there being active ws connections
        from website.api import websocket

        websocket.rest_notify_scoreboard(engine)
        websocket.rest_notify_weather(engine)
        websocket.rest_notify_global_data(engine)


def check_finished_constructions(engine):
    """function that checks if projects have finished, shipments have arrived or facilities arrived at end of life"""
    # check if constructions finished
    finished_constructions = UnderConstruction.query.filter(
        UnderConstruction.suspension_time.is_(None),
        UnderConstruction.start_time + UnderConstruction.duration <= engine.data["total_t"],
    ).all()
    if finished_constructions:
        for fc in finished_constructions:
            utils.add_asset(fc.player_id, fc.id)
            db.session.delete(fc)
        db.session.commit()

    # check if shipment arrived
    arrived_shipments = Shipment.query.filter(
        Shipment.departure_time.isnot(None),
        Shipment.suspension_time.is_(None),
        Shipment.departure_time + Shipment.duration <= engine.data["total_t"],
    ).all()
    if arrived_shipments:
        for a_s in arrived_shipments:
            utils.store_import(a_s.player, a_s.resource, a_s.quantity)
            db.session.delete(a_s)
        db.session.commit()

    # check end of lifespan of facilities
    eolt_facilities = ActiveFacilities.query.filter(ActiveFacilities.end_of_life <= engine.data["total_t"]).all()
    if eolt_facilities:
        for facility in eolt_facilities:
            utils.remove_asset(facility.player_id, facility)
        db.session.commit()
