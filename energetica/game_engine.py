"""Logic for the engine of the game."""

from __future__ import annotations

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
from threading import RLock
from typing import TYPE_CHECKING, Any, Callable, Literal

import socketio

from energetica.config.assets import config, const_config
from energetica.enums import Fuel, Renewable


# This is the engine object
class GameEngine(object):
    """Run the game engine. Contains all the data and methods to operate the game."""

    def __init__(self) -> None:
        """Initialize the game engine object."""
        if TYPE_CHECKING:
            from energetica.database.engine_data import EmissionData
        Path("instance").mkdir(exist_ok=True)
        self.config = config
        self.const_config = const_config
        self.socketio: socketio.AsyncServer = None  # type: ignore[assignment]
        self.console_logger = logging.getLogger("console")  # logs events in the terminal
        self.action_logger = logging.getLogger("action_history")  # logs all called functions to a file
        self.serve_local = True
        self.lock = RLock()

        self.db_model_instances: dict = {}
        self.clock_time: int = None  # type: ignore[assignment]
        self.in_game_seconds_per_tick: int = None  # type: ignore[assignment]

        self.uuid: uuid.UUID = None  # type: ignore[assignment]
        self.random_seed: int = None  # type: ignore[assignment]
        self.total_t: int = None  # type: ignore[assignment]
        self.start_date: datetime = None  # type: ignore[assignment]
        self.first_tick_time: datetime = None  # type: ignore[assignment]
        self.delta_t: int = None  # type: ignore[assignment]
        self.current_climate_data: EmissionData = None  # type: ignore[assignment]
        self.daily_question: dict = None  # type: ignore[assignment]
        self.question_order: list[int] = None  # type: ignore[assignment]
        self.technology_lvls: dict = None  # type: ignore[assignment]
        self.env: Literal["dev"] | Literal["prod"] = None  # type: ignore[assignment]

        with open("energetica/static/data/industry_demand.pck", "rb") as file:
            # array of length 1440 of normalized daily industry demand variations
            self.industry_demand = pickle.load(file)
        with open("energetica/static/data/industry_demand_year.pck", "rb") as file:
            # array of length 51 of normalized yearly industry demand variations
            self.industry_seasonal = pickle.load(file)

        self.log("engine created")

    def clear_db(self) -> None:
        """Clear all the data in the database."""
        from energetica.database import DBModel

        for db in DBModel.__subclasses__():
            db.instances().reset()

    def init_instance(
        self,
        clock_time: int,
        in_game_seconds_per_tick: int,
        random_seed: int,
        env: Literal["dev"] | Literal["prod"],
        start_date: datetime | None = None,
        instance_uuid: uuid.UUID | None = None,
    ) -> None:
        """Initialize the instance data / the GameEngine members."""
        from energetica.database.engine_data import EmissionData
        from energetica.database.map import HexTile
        from energetica.database.messages import Chat
        from energetica.utils.climate_helpers import data_init_climate

        assert clock_time in [60, 30, 20, 15, 12, 10, 6, 5, 4, 3, 2, 1]
        self.clock_time = clock_time
        self.in_game_seconds_per_tick = in_game_seconds_per_tick

        self.uuid = instance_uuid or uuid.uuid1()
        self.random_seed = random_seed
        self.env = env
        self.total_t = 0  # Number of simulated game ticks since server start
        self.start_date = start_date or datetime.now()  # 0 point of server time
        self.first_tick_time = self.start_date  # will be set to the correct time later on
        self.action_logger.info(
            json.dumps(
                {
                    "uuid": self.uuid.hex,
                    "clock_time": self.clock_time,
                    "in_game_seconds_per_tick": self.in_game_seconds_per_tick,
                    "action_type": "init_engine",
                    "random_seed": self.random_seed,
                    "start_date": self.start_date.isoformat(),
                },
            ),
        )
        last_midnight = self.start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        # time shift in ticks. Defines the number of ticks between
        # the first simulated tick and the beginning of in-game year 0.
        self.delta_t = round((self.start_date - last_midnight).total_seconds() // self.clock_time)
        # transform start_date to a seconds timestamp corresponding to the time of the first tick
        self.start_date = datetime.fromtimestamp(math.floor(self.start_date.timestamp() / clock_time) * clock_time)

        # All data for the current day will be stored here :
        self.current_climate_data = EmissionData(
            self.delta_t,
            in_game_seconds_per_tick,
            self.random_seed,
        )
        self.daily_question = {}
        self.question_order = None  # type: ignore
        self.new_daily_question()

        # stored the levels of technology of the server
        # for each tech an array stores [# players with lvl 1, # players with lvl 2, ...]
        self.technology_lvls = {
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

        Path("instance/data/players").mkdir(parents=True, exist_ok=True)
        Path("instance/data/servers").mkdir(parents=True, exist_ok=True)
        climate_data = data_init_climate(
            in_game_seconds_per_tick,
            self.random_seed,
            self.delta_t,
        )
        with open("instance/data/servers/climate_data.pck", "wb") as file:
            pickle.dump(climate_data, file)

        self.save()

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

    def log(self, message: str) -> None:
        """Log a message with the current time in the terminal."""
        self.console_logger.info(message)

    def warn(self, message: str) -> None:
        """Log a warning message in the terminal."""
        self.console_logger.warning(message)

    def log_action(self, action: dict) -> None:
        """Log an action in the action history file."""
        self.action_logger.info(json.dumps(action))

    def save(self) -> None:
        """Save the game engine data to a file."""
        members_to_save = [
            "clock_time",
            "in_game_seconds_per_tick",
            "uuid",
            "random_seed",
            "total_t",
            "start_date",
            "first_tick_time",
            "delta_t",
            "current_climate_data",
            "daily_question",
            "question_order",
            "technology_lvls",
            "db_model_instances",
        ]
        data = {member: getattr(self, member) for member in members_to_save}
        with open("instance/engine_data.pck", "wb") as file:
            pickle.dump(data, file)

    def load(self) -> None:
        """Load the game engine data from a file."""
        engine_data_last_modified = Path("instance/engine_data.pck").stat().st_mtime
        instance_data_last_modified = max(f.stat().st_mtime for f in Path("instance/data").glob("**/*") if f.is_file())
        if instance_data_last_modified > engine_data_last_modified:
            raise RuntimeError("The data has not been saved correctly, please restart form the last checkpoint.")
        with open("instance/engine_data.pck", "rb") as file:
            data = pickle.load(file)
            for member, member_data in data.items():
                setattr(self, member, member_data)

    def first_tick_time_epoch_ms(self) -> int:
        """Get the first tick time in epoch milliseconds."""
        return int(self.first_tick_time.timestamp() * 1000)

    def save_checkpoint(self, destination_filename: str = "checkpoints/last_checkpoint.tar.gz") -> None:
        self.save()
        with tarfile.open("checkpoints/new_checkpoint.tar.gz", "w:gz") as tar:
            tar.add("instance/")
        os.replace("checkpoints/new_checkpoint.tar.gz", destination_filename)

    def with_lock(self, func: Callable) -> Callable:
        """Run a function with the engine lock."""

        def wrapped(*args: Any, **kwargs: Any) -> Any:
            with self.lock:
                return func(*args, **kwargs)

        return wrapped

    def package_global_data(self) -> dict:
        """Package mutable from energetica.globals import engine data as a dict to be sent and used on the frontend."""
        return {
            "first_tick_date": self.start_date,
            "tick_length": self.clock_time,
            "total_ticks": self.total_t,
        }

    def new_daily_question(self) -> None:
        """Load a new daily question from the csv file."""
        with open("energetica/static/data/daily_quiz_questions.csv", "r", encoding="utf-8") as file:
            csv_reader = list(csv.DictReader(file))
        if self.question_order is None:
            self.question_order = list(range(len(csv_reader)))
            random.shuffle(self.question_order)
            question_index = 0
        else:
            question_index = (self.daily_question["index"] + 1) % len(csv_reader)
        self.daily_question = csv_reader[self.question_order[question_index]]
        self.daily_question["index"] = question_index
        self.daily_question["player_answers"] = {}


# TODO(mglst): Convert this class to an instance of GameError


class Confirm(Exception):
    """Use this class to ask the player to confirm an action."""

    def __init__(self, **kwargs: Any) -> None:
        self.__dict__.update(kwargs)
        Exception.__init__(self, "Please confirm this action.")
        Exception.__init__(self, "Please confirm this action.")
