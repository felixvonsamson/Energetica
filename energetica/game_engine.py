"""Logic for the engine of the game."""

import csv
import json
import logging
import math
import pickle
import random
from datetime import datetime

from flask_sock import Sock
from flask_socketio import SocketIO
from gevent.lock import RLock

from energetica.config.assets import config, const_config


# This is the engine object
class GameEngine(object):
    """Run the game engine. Contains all the data and methods to operate the game."""

    sock: Sock

    def __init__(self):
        self.config = config
        self.const_config = const_config
        self.socketio: SocketIO = None
        self.websocket_dict: dict = {}
        self.console_logger = logging.getLogger("console")  # logs events in the terminal
        self.action_logger = logging.getLogger("action_history")  # logs all called functions to a file
        self.init_loggers()
        self.lock = RLock()
        # TODO (Felix): is data really needed ? can't we just use the engine object directly ?
        # TODO(mglst): agree with Felix
        self.data = {}
        self.clock_time = None
        self.in_game_seconds_per_tick: int = None
        self.log("engine created")

    def clear_db(self):
        """Clear all the data in the database."""
        from energetica.database import DBModel

        for db in DBModel.__subclasses__():
            db.instances().reset()

    def init(self, clock_time, in_game_seconds_per_tick: int, random_seed, start_date=None):
        # TODO(mglst): Create an explicit __init__ method, maybe make this a dataclass. Bref, rework this class
        from energetica.database.engine_data import EmissionData

        assert clock_time in [60, 30, 20, 15, 12, 10, 6, 5, 4, 3, 2, 1]
        self.clock_time = clock_time
        self.in_game_seconds_per_tick = in_game_seconds_per_tick

        self.data["random_seed"] = random_seed
        self.data["total_t"] = 0  # Number of simulated game ticks since server start
        self.data["start_date"] = start_date or datetime.now()  # 0 point of server time
        self.data["first_tick_time"] = self.data["start_date"]  # will be set to the correct time later on
        self.action_logger.info(
            json.dumps(
                {
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
