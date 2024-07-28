from collections import defaultdict, deque
import json
import math
from flask import current_app
import numpy as np
import requests

from website.database.player_assets import Active_facilities
from website.config import river_discharge_seasonal


class CapacityData:
    """Class that stores the capacity data"""

    def __init__(self):
        self._data = {}

    def update(self, player, facility):
        """This function updates the capacity data of the player"""
        engine = current_app.config["engine"]
        if facility is None:
            active_facilities = Active_facilities.query.filter_by(player_id=player.id).all()
            unique_facilities = {af.facility for af in active_facilities}
            for uf in unique_facilities:
                self.init_facility(engine, uf)
        else:
            active_facilities = Active_facilities.query.filter_by(player_id=player.id, facility=facility).all()
            if len(active_facilities) == 0 and facility in self._data:
                del self._data[facility]
                return
            self.init_facility(engine, facility)

        for facility in active_facilities:
            base_data = engine.const_config["assets"][facility.facility]
            effective_values = self._data[facility.facility]
            op_costs = base_data["base_price"] * facility.price_multiplier * base_data["O&M_factor"]
            if facility.facility in ["watermill", "small_water_dam", "large_water_dam"]:
                op_costs *= facility.capacity_multiplier
            effective_values["O&M_cost"] += op_costs
            if facility.facility in engine.power_facilities:
                power_gen = base_data["base_power_generation"] * facility.power_multiplier
                effective_values["power"] += power_gen
                for fuel in effective_values["fuel_use"]:
                    effective_values["fuel_use"][fuel] += (
                        base_data["consumed_resource"][fuel]
                        / facility.efficiency_multiplier
                        * power_gen
                        * engine.clock_time
                        / 3600
                        / 10**6
                    )
            elif facility.facility in engine.storage_facilities:
                power_gen = base_data["base_power_generation"] * facility.power_multiplier
                # mean efficiency
                effective_values["efficiency"] = (
                    (effective_values["efficiency"] * effective_values["power"])
                    + (base_data["base_efficiency"] * facility.efficiency_multiplier * power_gen)
                ) / (effective_values["power"] + power_gen)
                effective_values["power"] += power_gen
                effective_values["capacity"] += base_data["base_storage_capacity"] * facility.capacity_multiplier
            elif facility.facility in engine.extraction_facilities:
                effective_values["extraction"] += base_data["extraction_rate"] * facility.capacity_multiplier
                effective_values["power_use"] += base_data["base_power_consumption"] * facility.power_multiplier
                effective_values["pollution"] += base_data["base_pollution"] * facility.efficiency_multiplier

        if player.network is not None:
            engine.data["network_capacities"][player.network.id].update_network(player.network)

    def update_network(self, network):
        """This function updates the capacity data of the network"""
        engine = current_app.config["engine"]
        self._data = {}
        for player in network.members:
            player_capacities = engine.data["player_capacities"][player.id].get_all()
            for facility in player_capacities:
                if "power" in player_capacities[facility]:
                    if facility not in self._data:
                        self._data[facility] = {"power": 0.0}
                    self._data[facility]["power"] += player_capacities[facility]["power"]

    def init_facility(self, engine, facility):
        const_config = engine.const_config["assets"]
        if facility in engine.power_facilities:
            self._data[facility] = {"O&M_cost": 0.0, "power": 0.0, "fuel_use": {}}
            for resource in const_config[facility]["consumed_resource"]:
                if const_config[facility]["consumed_resource"][resource] > 0:
                    self._data[facility]["fuel_use"][resource] = 0.0
            return
        if facility in engine.storage_facilities:
            self._data[facility] = {"O&M_cost": 0.0, "power": 0.0, "capacity": 0.0, "efficiency": 0.0}
            return
        if facility in engine.extraction_facilities:
            self._data[facility] = {"O&M_cost": 0.0, "extraction": 0.0, "power_use": 0.0, "pollution": 0.0}

    def __getitem__(self, facility):
        if facility not in self._data:
            return None
        return self._data[facility]

    def get_all(self):
        return self._data


class CircularBufferPlayer:
    """Class that stores the active data of a player"""

    def __init__(self):
        self._data = {
            "revenues": {
                "industry": deque([0.0] * 360, maxlen=360),
                "exports": deque([0.0] * 360, maxlen=360),
                "imports": deque([0.0] * 360, maxlen=360),
                "dumping": deque([0.0] * 360, maxlen=360),
            },
            "op_costs": {
                "steam_engine": deque([0.0] * 360, maxlen=360),
            },
            "generation": {
                "steam_engine": deque([0.0] * 360, maxlen=360),
                "imports": deque([0.0] * 360, maxlen=360),
            },
            "demand": {
                "industry": deque([0.0] * 360, maxlen=360),
                "construction": deque([0.0] * 360, maxlen=360),
                "research": deque([0.0] * 360, maxlen=360),
                "transport": deque([0.0] * 360, maxlen=360),
                "exports": deque([0.0] * 360, maxlen=360),
                "dumping": deque([0.0] * 360, maxlen=360),
            },
            "storage": {},
            "resources": {},
            "emissions": {
                "steam_engine": deque([0.0] * 360, maxlen=360),
                "construction": deque([0.0] * 360, maxlen=360),
            },
        }

    def append_value(self, new_value):
        for category, subcategories in new_value.items():
            for subcategory, value in subcategories.items():
                self._data[category][subcategory].append(value)

    def new_subcategory(self, category, subcategory):
        if subcategory not in self._data[category]:
            self._data[category][subcategory] = deque([0.0] * 360, maxlen=360)

    def get_data(self, t=216):
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
        """Returns a dict with the same structure as the data with 0 and with
        the last value for the storage and resources"""
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
            "network_data": {
                "price": deque([0.0] * 360, maxlen=360),
                "quantity": deque([0.0] * 360, maxlen=360),
            },
            "exports": {},
            "imports": {},
            "generation": {},
            "consumption": {},
        }

    def append_value(self, new_value):
        for category in self._data:
            for group, value in new_value[category].items():
                if group not in self._data[category]:
                    self._data[category][group] = deque([0.0] * 360, maxlen=360)
                self._data[category][group].append(value)
            for group in self._data[category]:
                if group not in new_value[category]:
                    self._data[category][group].append(0.0)

    def get_data(self, t=216):
        result = defaultdict(lambda: defaultdict(dict))
        for category in self._data:
            for group, buffer in self._data[category].items():
                result[category][group] = list(buffer)[-t:]
        return result


class WeatherData:
    """Class that stores the weather data"""

    def __init__(self):
        self._data = {
            "windspeed": deque([0.0] * 600, maxlen=600),
            "irradiance": deque([0.0] * 600, maxlen=600),
            "river_discharge": deque([0.0] * 600, maxlen=600),
        }

    def update_weather(self, engine):
        """This function upddates the windspeed and irradiation data every 10
        minutes using the meteosuisse api and calculates the river discharge for
        the next 10 min"""
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
            self._data[weather].extend([self._data[weather][-1]] * round(600 / engine.clock_time))

        for weather in urls:
            try:
                # TODO: add timeout argument for get requests.
                # This should probably depend on the game clock.
                response = requests.get(urls[weather][0])
                if response.status_code == 200:
                    datapoint = json.loads(response.content)["features"][urls[weather][1]]["properties"]["value"]
                    if weather == "windspeed":
                        datapoint *= 1.3  # increasing wind speed because windspeed in Zurich is lower than elswere
                    if datapoint > 2000:
                        datapoint = self._data[weather][-1]
                    interpolation = np.linspace(
                        self._data[weather][-1],
                        datapoint,
                        round(600 / engine.clock_time) + 1,
                    )
                    self._data[weather].extend(interpolation[1:])
                else:
                    log_error(response.status_code, weather)
            except Exception as e:
                log_error(e, weather)

        month = math.floor((engine.data["total_t"] % 25920) / 2160)
        # One year in game is 25920 ticks
        f = (engine.data["total_t"] % 25920) / 2160 - month

        d = river_discharge_seasonal
        power_factor = d[month] + (d[(month + 1) % 12] - d[month]) * f
        interpolation = np.linspace(
            self._data["river_discharge"][-1],
            power_factor,
            round(600 / engine.clock_time) + 1,
        )
        self._data["river_discharge"].extend(interpolation[1:])

    def __getitem__(self, weather):
        engine = current_app.config["engine"]
        total_t = engine.data["total_t"]
        i = total_t % round(600 / engine.clock_time) - round(600 / engine.clock_time)
        return self._data[weather][i]

    def package(self, total_t):
        return {
            "month_number": ((total_t % 25920) // 2160),
            "irradiance": self["irradiance"],
            "wind_speed": self["windspeed"],
            "river_discharge": self["river_discharge"],
        }


class EmissionData:
    """Class that stores the emission data"""

    def __init__(self):
        self._data = {
            # base value of 5Mt of CO2 in the atmosphere
            "CO2": deque([5.0 * 10**9] * 360, maxlen=360),
        }

    def add(self, key, value):
        self._data[key][-1] += value

    def init_new_value(self):
        for key in self._data:
            self._data[key].append(self._data[key][-1])

    def __getitem__(self, key):
        return self._data[key][-1]
