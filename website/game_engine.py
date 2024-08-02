"""Here is the logic for the engine of the game"""

import logging
import math
import pickle
import random
from collections import defaultdict
from datetime import datetime

from .config import config, const_config
from .database.engine_data import EmissionData, WeatherData


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
        self.data["random_seed"] = random.randint(0, 1000000)
        self.data["total_t"] = 0  # Number of simulated game ticks since server start
        self.data["start_date"] = datetime.now()  # 0 point of server time
        last_midnight = self.data["start_date"].replace(hour=0, minute=0, second=0, microsecond=0)
        # time shift in ticks. Defines the number of ticks since the begining of in-game year 0.
        self.data["delta_t"] = round((self.data["start_date"] - last_midnight).total_seconds() // self.clock_time)
        # transform start_date to a seconds timestamp corresponding to the time of the first tick
        self.data["start_date"] = math.floor(self.data["start_date"].timestamp() / clock_time) * clock_time

        # All data for the current day will be stored here :
        self.data["player_capacities"] = {}
        self.data["network_capacities"] = {}
        self.data["current_data"] = {}
        self.data["network_data"] = {}
        self.data["weather"] = WeatherData()
        self.data["current_climate_data"] = EmissionData(self.data["delta_t"], in_game_seconds_per_tick)

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
        }
