"""This file contains the classes for `CapacityData`, `CircularBufferPlayer`,
`CircularBufferNetwork`, `WeatherData`, and `EmissionData`"""

import json
import math
from collections import defaultdict, deque
from typing import List

import noise
import numpy as np
import requests
from flask import current_app

from website.config import river_discharge_seasonal
from website.database.player_assets import ActiveFacility


class CapacityData:
    """
    Class that stores precalculated maximum values per facility type of a player according to its active facilities.
    The data structure is as follows:
    {
        "facility_type": {
            "O&M_cost":         [¤/tick]                        # All facilities
            "power":            [W]                             # Power and storage facilities
            "fuel_use": {
                "resource":     [kg/tick]                       # Controllable facilities
            }
            "capacity":         [Wh]                            # Storage facilities
            "efficiency": (effective efficiency from 0 to 1),   # Storage facilities
            "extraction_rate_per_day": [kg/tick]                # Extraction facilities
            "power_use":        [W]                             # Extraction facilities
            "pollution":        [kg/tick]                       # Extraction facilities
        }
    }
    """

    def __init__(self):
        self._data = {}

    def update(self, player, facility):
        """This function updates the capacity data of the player"""
        engine = current_app.config["engine"]
        if facility is None:
            active_facilities: List[ActiveFacility] = ActiveFacility.query.filter_by(player_id=player.id).all()
            unique_facilities = {af.facility for af in active_facilities}
            for uf in unique_facilities:
                self.init_facility(engine, uf)
        else:
            active_facilities: List[ActiveFacility] = ActiveFacility.query.filter_by(
                player_id=player.id, facility=facility
            ).all()
            if len(active_facilities) == 0 and facility in self._data:
                del self._data[facility]
                return
            self.init_facility(engine, facility)

        for facility in active_facilities:
            base_data = engine.const_config["assets"][facility.facility]
            effective_values = self._data[facility.facility]
            op_costs = (
                base_data["base_price"]
                * facility.price_multiplier
                * base_data["O&M_factor_per_day"]
                * engine.in_game_seconds_per_tick
                / (24 * 3600)
            )
            if facility.facility in ["watermill", "small_water_dam", "large_water_dam"]:
                op_costs *= facility.multiplier_2
            effective_values["O&M_cost"] += op_costs
            if facility.facility in engine.power_facilities:
                power_gen = base_data["base_power_generation"] * facility.multiplier_1
                effective_values["power"] += power_gen
                for fuel in effective_values["fuel_use"]:
                    effective_values["fuel_use"][fuel] += (
                        base_data["consumed_resource"][fuel]
                        / facility.multiplier_3
                        * power_gen
                        * engine.in_game_seconds_per_tick
                        / 3600
                        / 1_000_000
                    )
            elif facility.facility in engine.storage_facilities:
                power_gen = base_data["base_power_generation"] * facility.multiplier_1
                # mean efficiency
                effective_values["efficiency"] = (
                    (effective_values["efficiency"] * effective_values["power"])
                    + (base_data["base_efficiency"] * facility.multiplier_3 * power_gen)
                ) / (effective_values["power"] + power_gen)
                effective_values["power"] += power_gen
                effective_values["capacity"] += base_data["base_storage_capacity"] * facility.multiplier_2
            elif facility.facility in engine.extraction_facilities:
                effective_values["extraction_rate_per_day"] += (
                    base_data["base_extraction_rate_per_day"] * facility.multiplier_2
                )
                effective_values["power_use"] += base_data["base_power_consumption"] * facility.multiplier_1
                effective_values["pollution"] += base_data["base_pollution"] * facility.multiplier_3

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
        """This function initializes the capacity data of a facility"""
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
            self._data[facility] = {"O&M_cost": 0.0, "extraction_rate_per_day": 0.0, "power_use": 0.0, "pollution": 0.0}

    def __getitem__(self, facility):
        if facility not in self._data:
            return None
        return self._data[facility]

    def get_all(self):
        """Returns the capacity data"""
        return self._data


class CircularBufferPlayer:
    """Class that stores the active data of a player (last 360 ticks of the graph data)"""

    def __init__(self):
        self._data = {
            "revenues": {  # v - added dynamically - v
                "industry": deque([0.0] * 360, maxlen=360),
                "exports": deque([0.0] * 360, maxlen=360),
                "imports": deque([0.0] * 360, maxlen=360),
                "dumping": deque([0.0] * 360, maxlen=360),
                "climate_events": deque([0.0] * 360, maxlen=360),
            },
            "op_costs": {
                "steam_engine": deque([0.0] * 360, maxlen=360),  # + other facilities
            },
            "generation": {
                "steam_engine": deque([0.0] * 360, maxlen=360),
                "imports": deque([0.0] * 360, maxlen=360),  # + other power and storage facilities
            },
            "demand": {
                "industry": deque([0.0] * 360, maxlen=360),
                "construction": deque([0.0] * 360, maxlen=360),
                "research": deque([0.0] * 360, maxlen=360),
                "transport": deque([0.0] * 360, maxlen=360),
                "exports": deque([0.0] * 360, maxlen=360),
                "dumping": deque([0.0] * 360, maxlen=360),  # + storage and extraction facilities
            },
            "storage": {},  # + storage facilities
            "resources": {},  # + all resources when warehouse is built
            "emissions": {
                "steam_engine": deque([0.0] * 360, maxlen=360),
                "construction": deque([0.0] * 360, maxlen=360),  # + other controllable facilities
            },
        }

    def append_value(self, new_value):
        """Adds one new tick of data to the buffer"""
        for category, subcategories in new_value.items():
            for subcategory, value in subcategories.items():
                self._data[category][subcategory].append(value)

    def new_subcategory(self, category, subcategory):
        """Adds a new subcategory to the data"""
        if subcategory not in self._data[category]:
            self._data[category][subcategory] = deque([0.0] * 360, maxlen=360)

    def get_data(self, t=216):
        """Returns the last t ticks of the data"""
        result = defaultdict(lambda: defaultdict(dict))
        for category, subcategories in self._data.items():
            for subcategory, buffer in subcategories.items():
                result[category][subcategory] = list(buffer)[-t:]
        return result

    def get_last_data(self, category, subcategory):
        """Returns the last value of a subcategory"""
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


class CumulativeEmissionsData:
    """
    This class stores the cumulative emissions of all facilities of a player
    """

    def __init__(self):
        self._data = {
            "steam_engine": 0.0,
            "construction": 0.0,
        }

    def add(self, facility, value):
        """Adds a value to the data"""
        self._data[facility] += value

    def new_category(self, facility):
        """Adds a new category to the data"""
        if facility not in self._data:
            self._data[facility] = 0.0

    def __getitem__(self, facility):
        if facility not in self._data:
            return None
        return self._data[facility]

    def get_all(self):
        """Returns the data"""
        return self._data


class CircularBufferNetwork:
    """Class that stores the active data of a Network"""

    def __init__(self):
        self._data = {
            "network_data": {
                "price": deque([0.0] * 360, maxlen=360),
                "quantity": deque([0.0] * 360, maxlen=360),
            },
            "exports": {},  # exports for each player
            "imports": {},  # imports for each player
            "generation": {},  # generation for each type (ex: "steam_engine")
            "consumption": {},  # consumption for each type (ex: "industry")
        }

    def append_value(self, new_value):
        """Adds one new tick of data to the buffer"""
        for category, category_value in self._data.items():
            for group, value in new_value[category].items():
                if group not in category_value:
                    category_value[group] = deque([0.0] * 360, maxlen=360)
                category_value[group].append(value)
            for group, value in category_value.items():
                if group not in new_value[category]:
                    value.append(0.0)

    def get_data(self, t=216):
        """Returns the last t ticks of the data"""
        result = defaultdict(lambda: defaultdict(dict))
        for category, value in self._data.items():
            for group, buffer in value.items():
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
        """
        This function updates the windspeed and irradiation data every 10
        minutes using the MétéoSuisse api and calculates the river discharge for
        the next 10 min
        """
        urls = {
            "windspeed": (
                (
                    "https://data.geo.admin.ch/ch.meteoschweiz.messwerte-"  # cspell:disable-line
                    "windgeschwindigkeit-kmh-10min/ch.meteoschweiz.messwerte-"  # cspell:disable-line
                    "windgeschwindigkeit-kmh-10min_en.json"  # cspell:disable-line
                ),
                107,
            ),
            "irradiance": (
                (
                    "https://data.geo.admin.ch/ch.meteoschweiz.messwerte-"  # cspell:disable-line
                    "globalstrahlung-10min/ch.meteoschweiz.messwerte-"  # cspell:disable-line
                    "globalstrahlung-10min_en.json"  # cspell:disable-line
                ),
                65,
            ),
        }

        def log_error(e, weather):
            engine.log("An error occurred:" + str(e))
            self._data[weather].extend([self._data[weather][-1]] * round(600 / engine.clock_time))

        for weather, url_and_offset in urls.items():
            try:
                url = url_and_offset[0]
                offset = url_and_offset[1]
                # TODO: add timeout argument for get requests.
                # This should probably depend on the game clock.
                response = requests.get(url)
                if response.status_code == 200:
                    datapoint = json.loads(response.content)["features"][offset]["properties"]["value"]
                    if weather == "windspeed":
                        datapoint *= 1.3  # increasing wind speed because windspeed in Zurich is lower than elsewhere
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
        """Returns the weather data for the current tick"""
        return {
            "month_number": ((total_t % 25920) // 2160),
            "irradiance": self["irradiance"],
            "wind_speed": self["windspeed"],
            "river_discharge": self["river_discharge"],
        }


class EmissionData:
    """Class that stores the emission and climate data of the server"""

    def __init__(self, delta_t, spt, random_seed):
        ref_temp = []
        temp_deviation = []
        for t in range(delta_t - 360, delta_t):
            ref_temp.append(calculate_reference_gta(t + 1, spt))
            temp_deviation.append(calculate_temperature_deviation(t + 1, spt, 4e10, random_seed))
        self._data = {
            "emissions": {
                "CO2": deque([4e10] * 360, maxlen=360),  # base value of 5Mt of CO2 in the atmosphere
            },
            "temperature": {
                "reference": deque(ref_temp, maxlen=360),
                "deviation": deque(temp_deviation, maxlen=360),
            },
        }

    def get_data(self, t=216):
        """Returns the last t ticks of the data"""
        result = defaultdict(lambda: defaultdict(dict))
        for category, subcategories in self._data.items():
            for subcategory, buffer in subcategories.items():
                result[category][subcategory] = list(buffer)[-t:]
        return result

    def add(self, key, value):
        """Adds a value to the data. Increasing the CO2 levels"""
        self._data["emissions"][key][-1] += value

    def init_new_value(self):
        """Generates the new values for CO2, reference temperature and temperature deviation"""
        # Keeping the CO2 levels form one tick to the next
        self._data["emissions"]["CO2"].append(self._data["emissions"]["CO2"][-1])
        # Calculating new temperatures
        engine = current_app.config["engine"]
        t = engine.data["total_t"] + engine.data["delta_t"]
        self._data["temperature"]["reference"].append(calculate_reference_gta(t, engine.in_game_seconds_per_tick))
        self._data["temperature"]["deviation"].append(
            calculate_temperature_deviation(
                t,
                engine.in_game_seconds_per_tick,
                self._data["emissions"]["CO2"][0],
                engine.data["random_seed"],
            )
        )

    def get_last_data(self):
        """Returns the last value for each subcategory"""
        last_values = {}
        for category, subcategories in self._data.items():
            last_values[category] = {}
            for subcategory, values in subcategories.items():
                last_values[category][subcategory] = values[-1]
        return last_values

    def get_co2(self):
        """Returns the last value of the CO2 levels"""
        return self._data["emissions"]["CO2"][-1]


def calculate_reference_gta(tick, seconds_per_tick):
    """Function for the servers reference global average temperature"""
    month = tick * seconds_per_tick / 518_400
    return 13.65 - math.sin((month + 2) * math.pi / 6) * 1.9


def calculate_temperature_deviation(tick, seconds_per_tick, co2_levels, random_seed):
    """Function that calculates the GAT deviation from the CO2 levels"""
    ticks_per_year = 60 * 60 * 24 * 72 / seconds_per_tick
    temperature_deviation = (co2_levels - 4e10) / 1.33e10
    perlin1 = noise.pnoise1(tick / ticks_per_year, base=random_seed)
    perlin2 = noise.pnoise1(tick / ticks_per_year * 6, base=random_seed)
    perlin_disturbance = 0.4 * perlin1 + 0.1 * perlin2
    return temperature_deviation + perlin_disturbance
