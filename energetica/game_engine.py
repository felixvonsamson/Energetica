"""Logic for the engine of the game."""

import csv
import json
import logging
import math
import os
import pickle
import random
import tarfile
import uuid
from datetime import datetime
from pathlib import Path

from flask_sock import Sock
from flask_socketio import SocketIO
from gevent.lock import RLock

from energetica.config.assets import config, const_config
from energetica.enums import Fuel, Renewable


# This is the engine object
class GameEngine(object):
    """Run the game engine. Contains all the data and methods to operate the game."""

    sock: Sock

    # TODO(mglst): move and refactor all these constants

    power_facilities = [
        "steam_engine",
        "windmill",
        "watermill",
        "coal_burner",
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

    extraction_facilities = [
        "coal_mine",
        "gas_drilling_site",
        "uranium_mine",
    ]

    extractable_resources = ["coal", "gas", "uranium"]

    storage_facilities = [
        "small_pumped_hydro",
        "molten_salt",
        "large_pumped_hydro",
        "hydrogen_storage",
        "lithium_ion_batteries",
        "solid_state_batteries",
    ]

    controllable_facilities = [
        "steam_engine",
        "nuclear_reactor",
        "nuclear_reactor_gen4",
        "combined_cycle",
        "gas_burner",
        "coal_burner",
    ]

    renewables = [
        "small_water_dam",
        "large_water_dam",
        "watermill",
        "onshore_wind_turbine",
        "offshore_wind_turbine",
        "windmill",
        "CSP_solar",
        "PV_solar",
    ]

    functional_facilities = [
        "industry",
        "laboratory",
        "warehouse",
        "carbon_capture",
    ]

    technologies = [
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

    special_power_demand = [
        "industry",
        "construction",
        "research",
        "transport",
        "carbon_capture",
    ]

    facility_types = power_facilities + extraction_facilities + storage_facilities + functional_facilities

    all_asset_types = facility_types + technologies

    asset_family_by_name = {
        asset_type: asset_family
        for dict in [vars()]
        for asset_family in [
            "Power Facilities",
            "Extraction Facilities",
            "Storage Facilities",
            "Functional Facilities",
            "Technologies",
        ]
        for asset_type in dict[asset_family.lower().replace(" ", "_")]
    }

    def __init__(self):
        Path("instance").mkdir(exist_ok=True)
        self.config = config
        self.const_config = const_config
        self.socketio: SocketIO = None
        self.websocket_dict: dict = {}
        self.console_logger = logging.getLogger("console")  # logs events in the terminal
        self.action_logger = logging.getLogger("action_history")  # logs all called functions to a file
        self.init_loggers()
        self.serve_local = True
        self.lock = RLock()
        # TODO (Felix): is data really needed ? can't we just use the engine object directly ?
        # TODO(mglst): agree with Felix
        self.data = {}
        self.clock_time = None
        self.in_game_seconds_per_tick = None
        self.log("engine created")

    def clear_db(self):
        """Clear all the data in the database."""
        from energetica.database import DBModel

        for db in DBModel.__subclasses__():
            db.instances().reset()

    def init(self, clock_time, in_game_seconds_per_tick: int, random_seed, start_date=None, instance_uuid=None):
        # TODO(mglst): Create an explicit __init__ method, maybe make this a dataclass. Bref, rework this class
        from energetica.database.engine_data import EmissionData
        from energetica.database.map import HexTile
        from energetica.database.messages import Chat
        from energetica.utils.climate_helpers import data_init_climate

        assert clock_time in [60, 30, 20, 15, 12, 10, 6, 5, 4, 3, 2, 1]
        self.clock_time = clock_time
        self.in_game_seconds_per_tick: int = in_game_seconds_per_tick

        self.data["uuid"] = instance_uuid or uuid.uuid1()
        self.data["random_seed"] = random_seed
        self.data["total_t"] = 0  # Number of simulated game ticks since server start
        self.data["start_date"] = start_date or datetime.now()  # 0 point of server time
        self.data["first_tick_time"] = self.data["start_date"]  # will be set to the correct time later on
        self.action_logger.info(
            json.dumps(
                {
                    "uuid": self.data["uuid"].hex,
                    "clock_time": self.clock_time,
                    "in_game_seconds_per_tick": self.in_game_seconds_per_tick,
                    "action_type": "init_engine",
                    "random_seed": self.data["random_seed"],
                    "start_date": self.data["start_date"].isoformat(),
                },
            ),
        )
        last_midnight = self.data["start_date"].replace(hour=0, minute=0, second=0, microsecond=0)
        # time shift in ticks. Defines the number of ticks between
        # the first simulated tick and the beginning of in-game year 0.
        self.data["delta_t"] = round((self.data["start_date"] - last_midnight).total_seconds() // self.clock_time)
        # transform start_date to a seconds timestamp corresponding to the time of the first tick
        self.data["start_date"] = math.floor(self.data["start_date"].timestamp() / clock_time) * clock_time

        # All data for the current day will be stored here :
        self.data["current_climate_data"] = EmissionData(
            self.data["delta_t"],
            in_game_seconds_per_tick,
            self.data["random_seed"],
        )
        self.data["daily_question"] = {}
        self.data["question_order"] = None
        self.new_daily_question()

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

        with open("energetica/static/data/industry_demand.pck", "rb") as file:
            # array of length 1440 of normalized daily industry demand variations
            self.industry_demand = pickle.load(file)
        with open("energetica/static/data/industry_demand_year.pck", "rb") as file:
            # array of length 51 of normalized yearly industry demand variations
            self.industry_seasonal = pickle.load(file)

        self.clear_db()

        with open("energetica/static/data/map.csv", "r", encoding="utf-8") as file:
            csv_reader = csv.DictReader(file)
            for row in csv_reader:
                tile = HexTile(coordinates=(int(row["q"]), int(row["r"])), climate_risk=int(row["climate_risk"]))
                for renewable in Renewable:
                    tile.potentials[renewable] = float(row[renewable])
                for fuel in Fuel:
                    tile.fuel_reserves[fuel] = float(row[fuel])

        # creating general chat
        Chat(
            name="General Chat",
            participants=set(),
        )

        Path("instance/player_data").mkdir(parents=True, exist_ok=True)
        Path("instance/server_data").mkdir(parents=True, exist_ok=True)
        with open("instance/server_data/climate_data.pck", "wb") as file:
            climate_data = data_init_climate(
                in_game_seconds_per_tick,
                self.data["random_seed"],
                self.data["delta_t"],
            )
            pickle.dump(climate_data, file)

    def init_loggers(self) -> None:
        """Initialize the loggers for the engine."""
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

    def log(self, message) -> None:
        """Log a message with the current time in the terminal."""
        self.console_logger.info(message)

    def warn(self, message) -> None:
        """Log a warning message in the terminal."""
        self.console_logger.warning(message)

    def save(self) -> None:
        """Save the game engine data to a file."""
        with open("instance/engine_data.pck", "wb") as file:
            pickle.dump(self.data, file)

    def load(self) -> None:
        """Load the game engine data from a file."""
        with open("instance/engine_data.pck", "rb") as file:
            self.data = pickle.load(file)

    def save_checkpoint(self) -> None:
        with tarfile.open("checkpoints/new_checkpoint.tar.gz", "w:gz") as tar:
            tar.add("instance/")
        os.replace("checkpoints/new_checkpoint.tar.gz", "checkpoints/last_checkpoint.tar.gz")

    def package_global_data(self) -> dict:
        """Package mutable from energetica.globals import engine data as a dict to be sent and used on the frontend."""
        return {
            "first_tick_date": self.data["start_date"],
            "tick_length": self.clock_time,
            "total_ticks": self.data["total_t"],
        }

    def new_daily_question(self) -> None:
        """Load a new daily question from the csv file."""
        with open("energetica/static/data/daily_quiz_questions.csv", "r", encoding="utf-8") as file:
            csv_reader = list(csv.DictReader(file))
        if self.data["question_order"] is None:
            self.data["question_order"] = list(range(len(csv_reader)))
            random.shuffle(self.data["question_order"])
            question_index = 0
        else:
            question_index = (self.data["daily_question"]["index"] + 1) % len(csv_reader)
        self.data["daily_question"] = csv_reader[self.data["question_order"][question_index]]
        self.data["daily_question"]["index"] = question_index
        self.data["daily_question"]["player_answers"] = {}


# TODO(mglst): Convert this class to an instance of GameError


class Confirm(Exception):
    """Use this class to ask the player to confirm an action."""

    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)
        Exception.__init__(self, "Please confirm this action.")
