"""
Here are defined the classes for the items stored in the database
"""

from .. import db
import requests
import json
import math
import numpy as np
from collections import defaultdict, deque

# table that links chats to players
player_chats = db.Table(
    "player_chats",
    db.Column("player_id", db.Integer, db.ForeignKey("player.id")),
    db.Column("chat_id", db.Integer, db.ForeignKey("chat.id")),
)

# table that links notifications to players
player_notifications = db.Table(
    "player_notifications",
    db.Column("player_id", db.Integer, db.ForeignKey("player.id")),
    db.Column("notification_id", db.Integer, db.ForeignKey("notification.id")),
)


class Hex(db.Model):
    """class for the tiles that compose the map"""

    id = db.Column(db.Integer, primary_key=True)
    q = db.Column(db.Integer)
    r = db.Column(db.Integer)
    solar = db.Column(db.Float)
    wind = db.Column(db.Float)
    hydro = db.Column(db.Integer)
    coal = db.Column(db.Float)
    oil = db.Column(db.Float)
    gas = db.Column(db.Float)
    uranium = db.Column(db.Float)
    player_id = db.Column(
        db.Integer, db.ForeignKey("player.id"), unique=True, nullable=True
    )  # ID of the owner of the tile

    def __repr__(self):
        return f"<Tile {self.id} wind {self.wind}>"


class Under_construction(db.Model):
    """class that stores the things currently under construction"""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    family = db.Column(db.String(50))
    # to assign the thing to the correct page
    start_time = db.Column(db.Float)
    duration = db.Column(db.Float)
    suspension_time = db.Column(db.Float)
    # time at witch the construction has been paused if it has
    original_price = db.Column(db.Float)
    # Price of the construction on the time of start of construction
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))
    # can access player directly with .player


class Active_facilites(db.Model):
    """Class that stores the facilites on the server and their end of life time."""

    id = db.Column(db.Integer, primary_key=True)
    facility = db.Column(db.String(50))
    end_of_life = db.Column(db.Float)
    # time at witch the facility will be decomissioned
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))
    # can access player directly with .player


class Shipment(db.Model):
    """Class that stores the resources shipment on their way"""

    id = db.Column(db.Integer, primary_key=True)
    resource = db.Column(db.String(10))
    quantity = db.Column(db.Float)
    departure_time = db.Column(db.Float)
    duration = db.Column(db.Float)
    suspension_time = db.Column(
        db.Float, default=None
    )  # time at witch the shipment has been paused if it has
    player_id = db.Column(
        db.Integer, db.ForeignKey("player.id")
    )  # can access player directly with .player


class Resource_on_sale(db.Model):
    """Class that stores resources currently on sale"""

    id = db.Column(db.Integer, primary_key=True)
    resource = db.Column(db.String(10))
    quantity = db.Column(db.Float)
    price = db.Column(db.Float)
    creation_date = db.Column(db.DateTime)
    player_id = db.Column(
        db.Integer, db.ForeignKey("player.id")
    )  # can access player directly with .player


# class that stores chats with 2 or more players :
class Chat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    messages = db.relationship("Message", backref="chat")


# class that stores messages :
class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text)
    time = db.Column(db.DateTime)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))
    chat_id = db.Column(db.Integer, db.ForeignKey("chat.id"))


class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(50))
    content = db.Column(db.Text)
    time = db.Column(db.DateTime)
    read = db.Column(db.Boolean, default=False)


class CircularBufferPlayer:
    """Class that stores the active data of a player"""

    def __init__(self):
        self._data = {
            "revenues": {
                "industry": deque([0.0] * 120, maxlen=120),
                "O&M_costs": deque([0.0] * 120, maxlen=120),
                "exports": deque([0.0] * 120, maxlen=120),
                "imports": deque([0.0] * 120, maxlen=120),
                "dumping": deque([0.0] * 120, maxlen=120),
            },
            "op_costs": {
                "steam_engine": deque([0.0] * 120, maxlen=120),
            },
            "generation": {
                "steam_engine": deque([0.0] * 120, maxlen=120),
                "imports": deque([0.0] * 120, maxlen=120),
            },
            "demand": {
                "industry": deque([0.0] * 120, maxlen=120),
                "construction": deque([0.0] * 120, maxlen=120),
                "research": deque([0.0] * 120, maxlen=120),
                "transport": deque([0.0] * 120, maxlen=120),
                "exports": deque([0.0] * 120, maxlen=120),
                "dumping": deque([0.0] * 120, maxlen=120),
            },
            "storage": {},
            "resources": {},
            "emissions": {
                "steam_engine": deque([0.0] * 120, maxlen=120),
                "construction": deque([0.0] * 120, maxlen=120),
            },
        }

    def append_value(self, new_value):
        for category, subcategories in new_value.items():
            for subcategory, value in subcategories.items():
                self._data[category][subcategory].append(value)

    def new_subcategory(self, category, subcategory):
        if subcategory not in self._data[category]:
            self._data[category][subcategory] = deque([0.0] * 120, maxlen=120)

    def get_data(self, t=60):
        result = defaultdict(lambda: defaultdict(dict))
        for category, subcategories in self._data.items():
            for subcategory, buffer in subcategories.items():
                result[category][subcategory] = list(buffer)[-t:]
        return result

    def get_last_data(self, category, subcategory):
        if category in self._data and subcategory in self._data[category]:
            return self._data[category][subcategory][-1]
        return 0

    def init_new_data(self):
        """returns a dict with the same structure as the data with 0 and with the last value for the storage and resources"""
        result = {}
        for category, subcategories in self._data.items():
            result[category] = {}
            for subcategory, buffer in subcategories.items():
                if category in ["storage", "resources"]:
                    result[category][subcategory] = buffer[-1]
                else:
                    result[category][subcategory] = 0.0
        return result


class CircularBufferNetwork:
    """Class that stores the active data of a Network"""

    def __init__(self):
        self._data = {
            "price": deque([0.0] * 120, maxlen=120),
            "quantity": deque([0.0] * 120, maxlen=120),
        }

    def append_value(self, new_value):
        for category, value in new_value.items():
            self._data[category].append(value)

    def get_data(self, t=60):
        result = defaultdict(lambda: defaultdict(dict))
        for category, buffer in self._data.items():
            result[category] = list(buffer)[-t:]
        return result


class WeatherData:
    """Class that stores the weather data"""

    def __init__(self):
        self._data = {
            "windspeed": deque([0.0] * 120, maxlen=120),
            "irradiance": deque([0.0] * 120, maxlen=120),
            "river_discharge": deque([0.0] * 120, maxlen=120),
        }

    def update_weather(self, engine):
        """This function upddates the windspeed and irradiation data every 10 minutes using the meteosuisse api and calculates the river discharge for the next 10 min"""
        urls = {
            "windspeed": (
                "https://data.geo.admin.ch/ch.meteoschweiz.messwerte-windgeschwindigkeit-kmh-10min/ch.meteoschweiz.messwerte-windgeschwindigkeit-kmh-10min_en.json",
                107,
            ),
            "irradiance": (
                "https://data.geo.admin.ch/ch.meteoschweiz.messwerte-globalstrahlung-10min/ch.meteoschweiz.messwerte-globalstrahlung-10min_en.json",
                65,
            ),
        }

        def log_error(e, weather):
            engine.log("An error occurred:" + str(e))
            self._data[weather].extend([self._data[weather][-1]] * 10)

        for weather in urls:
            try:
                response = requests.get(urls[weather][0])
                if response.status_code == 200:
                    datapoint = json.loads(response.content)["features"][
                        urls[weather][1]
                    ]["properties"]["value"]
                    if datapoint > 2000:
                        datapoint = self._data[weather][-1]
                    interpolation = np.linspace(
                        self._data[weather][-1], datapoint, 11
                    )
                    self._data[weather].extend(interpolation[1:])
                else:
                    log_error(response.status_code, weather)
            except Exception as e:
                log_error(e, weather)

        month = math.floor((engine.data["total_t"] % 73440) / 6120)
        # One year in game is 51 days
        f = (engine.data["total_t"] % 73440) / 6120 - month
        from ..config import river_discharge_seasonal

        d = river_discharge_seasonal
        power_factor = d[month] + (d[(month + 1) % 12] - d[month]) * f
        interpolation = np.linspace(
            self._data["river_discharge"][-1], power_factor, 11
        )
        self._data["river_discharge"].extend(interpolation[1:])

    def __getitem__(self, weather):
        return self._data[weather][-1]

    def package(self, total_t):
        return {
            "month_number": ((total_t % 73440) // 6120),
            "irradiance": self["irradiance"],
            "wind_speed": self["windspeed"],
            "river_discharge": self["river_discharge"] * 150,
        }


class EmissionData:
    """Class that stores the emission data"""

    def __init__(self):
        self._data = {
            "CO2": deque([0.0] * 120, maxlen=120),
        }

    def add(self, type, value):
        self._data[type][-1] += value

    def init_new_value(self):
        for type in self._data:
            self._data[type].append(self._data[type][-1])

    def __getitem__(self, type):
        return self._data[type][-1]
