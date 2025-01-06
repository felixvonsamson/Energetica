"""Module defining the classes for CapacityData, CircularBufferPlayer, CircularBufferNetwork, and EmissionData."""

from __future__ import annotations

import math
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Literal

import noise

from energetica.game_error import GameError
from energetica.globals import engine

if TYPE_CHECKING:
    from typing import Tuple

    from energetica.database.network import Network
    from energetica.database.player import Player


@dataclass
class NetworkPrices:
    """
    Tracks a player's renewable bids, bid prices, and ask prices by facility type.

    - `renewable_bids`: A list of renewable facilities.
    - `bid_prices`: A dictionary of controllable and storage facility types with their bid prices.
    - `ask_prices`: A dictionary of storage, extraction, and special demand facility types with their ask prices.
      (e.g., research, transport, industry and construction)

    Entries are added or removed as facilities are built or decommissioned.
    """

    renewable_bids: list[str] = field(default_factory=list)

    bid_prices: dict[str, float] = field(default_factory=lambda: {"steam_engine": 125.0})
    ask_prices: dict[str, float] = field(default_factory=lambda: {"industry": 1000.0, "construction": 1020.0})

    # TODO(mglst, Yassir): Add randomness to the default prices so that each player's prices are slightly different
    def add_bid(self, bid_name: str) -> None:
        """Add a facility to the list of bids, using the default price."""
        self.bid_prices[bid_name] = {
            "steam_engine": 125.0,
            "coal_burner": 600.0,
            "gas_burner": 500.0,
            "combined_cycle": 450.0,
            "nuclear_reactor": 275.0,
            "nuclear_reactor_gen4": 375.0,
            "small_pumped_hydro": 790.0,
            "molten_salt": 830.0,
            "large_pumped_hydro": 780.0,
            "hydrogen_storage": 880.0,
            "lithium_ion_batteries": 940.0,
            "solid_state_batteries": 900.0,
        }[bid_name]

    def add_ask(self, ask_name: str) -> None:
        """Add a facility to the list of asks, using the default price."""
        self.ask_prices[ask_name] = {
            "research": 1200.0,
            "transport": 1050.0,
            "coal_mine": 960.0,
            "gas_drilling_site": 980.0,
            "uranium_mine": 990.0,
            "carbon_capture": 660.0,
            "small_pumped_hydro": 210.0,
            "molten_salt": 190.0,
            "large_pumped_hydro": 200.0,
            "hydrogen_storage": 230.0,
            "lithium_ion_batteries": 425.0,
            "solid_state_batteries": 420.0,
        }[ask_name]

    def update(
        self,
        updated_bids: dict[str, float],
        updated_asks: dict[str, float],
    ) -> None:
        """Update the prices of the player for each facility type."""
        for facility, new_price in updated_bids.items():
            if facility not in engine.controllable_facilities + engine.storage_facilities:
                raise GameError("malformedRequest")
            if not isinstance(new_price, (int, float)):
                raise GameError("malformedRequest")
            if new_price <= -5:
                raise GameError("priceTooLow")
        for facility, new_price in updated_asks.items():
            if facility not in engine.special_power_demand + engine.extraction_facilities + engine.storage_facilities:
                raise GameError("malformedRequest")
            if not isinstance(new_price, (int, float)):
                raise GameError("malformedRequest")
            if new_price <= -5:
                raise GameError("priceTooLow")
        self.ask_prices |= updated_asks
        self.bid_prices |= updated_bids

    AskBid = Literal["ask", "bid"]  # Helper type

    def get_sorted_renewables(self) -> list[str]:
        """Return the player's renewable bids sorted by price."""
        self.renewable_bids.sort(key=engine.renewables.index)
        return self.renewable_bids

    def get_facility_priorities(self) -> list[Tuple[AskBid, str]]:
        """Return the player's priority lists containing asks and bids but not renewables, sorted by price."""
        type_key_price: list[Tuple[Literal["ask", "bid"], str, float]] = [
            *(("bid", key, price) for key, price in self.bid_prices.items()),
            *(("ask", key, price) for key, price in self.ask_prices.items()),
        ]
        type_key_price.sort(key=lambda x: x[2])
        return [(x[0], x[1]) for x in type_key_price]

    def change_facility_priority(self, new_priority: list[str]) -> None:
        """
        Reassign the selling prices of the facilities according to the new priority order.

        Executed when the facilities priority is changed by changing the order in the interactive table for players
        that are not in a network.
        """
        # Check if the new priority list is valid, i.e. contains the same elements as the old one
        old_set = {
            *{f"ask-{ask_name}" for ask_name in self.ask_prices},
            *{f"bid-{bid_name}" for bid_name in self.bid_prices},
        }
        if old_set != set(new_priority):
            raise GameError("malformedRequest")

        # Reorder the prices according to the new priority list
        sorted_prices = sorted((*self.ask_prices.values(), *self.bid_prices.values()))
        updated_bid_prices = {}
        updated_ask_prices = {}
        for facility, price in zip(new_priority, sorted_prices):
            if facility.startswith("ask-"):
                updated_ask_prices[facility[4:]] = price
            else:
                updated_bid_prices[facility[4:]] = price
        self.update(updated_bid_prices, updated_ask_prices)


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
            "capacity":         [Wh]                            # Storage Facilities
            "efficiency": (effective efficiency from 0 to 1),   # Storage Facilities
            "extraction_rate_per_day": [kg/tick]                # Extraction Facilities
            "power_use":        [W]                             # Extraction Facilities
            "pollution":        [kg/tick]                       # Extraction Facilities
        }
    }
    """

    def __init__(self):
        # TODO (Yassir): Add ref to the player in init
        self._data: dict[str, dict] = {}

    def update(self, player: Player, facility_name: str | None) -> None:
        """Update the capacity data of the player."""
        from energetica.database.active_facility import ActiveFacility

        active_facilities: list[ActiveFacility]
        if facility_name is None:
            active_facilities = list(ActiveFacility.filter_by(player=player))
            unique_facilities = {af.name for af in active_facilities}
            for uf in unique_facilities:
                self.init_facility(uf)
        else:
            active_facilities = list(ActiveFacility.filter_by(player=player, name=facility_name))
            if len(active_facilities) == 0 and facility_name in self._data:
                del self._data[facility_name]
                return
            self.init_facility(facility_name)

        for facility in active_facilities:
            base_data = engine.const_config["assets"][facility.name]
            effective_values = self._data[facility.name]
            op_costs = facility.daily_op_cost * engine.in_game_seconds_per_tick / (24 * 3600)
            if facility.name in ["watermill", "small_water_dam", "large_water_dam"]:
                op_costs *= facility.multipliers["multiplier_2"]
            effective_values["O&M_cost"] += op_costs
            if facility.name in engine.power_facilities:
                power_gen = facility.max_power_generation
                effective_values["power"] += power_gen
                for fuel in effective_values["fuel_use"]:
                    effective_values["fuel_use"][fuel] += (
                        base_data["consumed_resource"][fuel]
                        / facility.multipliers["multiplier_3"]
                        * power_gen
                        * engine.in_game_seconds_per_tick
                        / 3600
                        / 1_000_000
                    )
            elif facility.name in engine.storage_facilities:
                power_gen = facility.max_power_generation
                # mean efficiency
                effective_values["efficiency"] = (
                    (effective_values["efficiency"] * effective_values["power"])
                    + (base_data["base_efficiency"] * facility.multipliers["multiplier_3"] * power_gen)
                ) / (effective_values["power"] + power_gen)
                effective_values["power"] += power_gen
                if facility.end_of_life > 0:
                    effective_values["capacity"] += facility.storage_capacity
            elif facility.name in engine.extraction_facilities:
                effective_values["extraction_rate_per_day"] += (
                    base_data["base_extraction_rate_per_day"] * facility.multipliers["multiplier_2"]
                )
                effective_values["power_use"] += (
                    base_data["base_power_consumption"] * facility.multipliers["multiplier_1"]
                )
                effective_values["pollution"] += base_data["base_pollution"] * facility.multipliers["multiplier_3"]

        if player.network is not None:
            player.network.capacities.update_network(player.network)

    def update_network(self, network: Network) -> None:
        """Update the capacity data of the network."""
        self._data = {}
        for player in network.members:
            player_capacities = player.capacities.get_all()
            for facility in player_capacities:
                if "power" in player_capacities[facility]:
                    if facility not in self._data:
                        self._data[facility] = {"power": 0.0}
                    self._data[facility]["power"] += player_capacities[facility]["power"]

    def init_facility(self, facility: str) -> None:
        """Initialize the capacity data of a facility."""
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

    def __getitem__(self, facility: str) -> dict:
        """Return the capacity data of a facility."""
        if facility not in self._data:
            return None  # TODO(mglst): either the type should be Optional[dict] or an error should be raised
        return self._data[facility]

    def get_all(self) -> dict[str, dict]:
        """Return the capacity data."""
        return self._data

    def contains(self, facility: str) -> bool:
        """Return true if the facility is in the capacity data."""
        return facility in self._data


class CircularBufferPlayer:
    """Class that stores the active data of a player (last 360 ticks of the graph data)."""

    def __init__(self):
        """
        Initialize the engine data structure with default values.

        def create_deque():
            return deque([0.0] * 360, maxlen=360)
        self._data = {
            "revenues": defaultdict(create_deque),
            "op_costs": defaultdict(create_deque),
            "generation": defaultdict(create_deque),
            "demand": defaultdict(create_deque),
            "storage": defaultdict(create_deque),
            "resources": defaultdict(create_deque),
            "emissions": defaultdict(create_deque),
        }
        """
        # TODO (Yassir): Change to defaultdict
        self._data = {
            "revenues": {  # v - added dynamically - v
                "industry": deque([0.0] * 360, maxlen=360),
                "exports": deque([0.0] * 360, maxlen=360),
                "imports": deque([0.0] * 360, maxlen=360),
                "dumping": deque([0.0] * 360, maxlen=360),
                "climate_events": deque([0.0] * 360, maxlen=360),
            },
            "op_costs": {},  # + all facilities
            "generation": {
                "imports": deque([0.0] * 360, maxlen=360),  # + power and storage facilities
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
                "construction": deque([0.0] * 360, maxlen=360),  # + controllable facilities
            },
        }

    def append_value(self, new_value) -> None:
        """Add one new tick of data to the buffer."""
        for category, subcategories in new_value.items():
            for subcategory, value in subcategories.items():
                self._data[category][subcategory].append(value)

    def add_subcategory(self, category: str, subcategory: str) -> None:
        """Add a new subcategory to the data."""
        if subcategory not in self._data[category]:
            self._data[category][subcategory] = deque([0.0] * 360, maxlen=360)

    def get_data(self, t: int = 216):
        """Return the last t ticks of the data."""
        result = defaultdict(lambda: defaultdict(dict))
        for category, subcategories in self._data.items():
            for subcategory, buffer in subcategories.items():
                result[category][subcategory] = list(buffer)[-t:]
        return result

    def get_last_data(self, category, subcategory):
        """Return the last value of a subcategory."""
        if category in self._data and subcategory in self._data[category]:
            return self._data[category][subcategory][-1]
        return 0

    def init_new_data(self) -> dict:
        """Generate the new values for the data.

        Return a dict with the same structure as the data with 0 and with the last value for the storage and resources.
        """
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
    """Class storing the cumulative emissions of all facilities of a player."""

    def __init__(self):
        self._data: dict[str, float] = {
            "steam_engine": 0.0,
            "construction": 0.0,
        }

    def add(self, facility: str, value: float) -> None:
        """Add a value to the data."""
        self._data[facility] += value

    def add_category(self, facility: str) -> None:
        """Add a new category to the data."""
        if facility not in self._data:
            self._data[facility] = 0.0

    def __getitem__(self, facility: str) -> float:
        """Return the data of a facility."""
        if facility not in self._data:
            return None
        return self._data[facility]

    def get_all(self) -> dict[str, float]:
        """Return the data."""
        return self._data


class CircularBufferNetwork:
    """Class that stores the active data of a Network."""

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
        """Add one new tick of data to the buffer."""
        for category, category_value in self._data.items():
            for group, value in new_value[category].items():
                if group not in category_value:
                    category_value[group] = deque([0.0] * 360, maxlen=360)
                category_value[group].append(value)
            for group, value in category_value.items():
                if group not in new_value[category]:
                    value.append(0.0)

    def get_data(self, t=216):
        """Return the last t ticks of the data."""
        result = defaultdict(lambda: defaultdict(dict))
        for category, value in self._data.items():
            for group, buffer in value.items():
                result[category][group] = list(buffer)[-t:]
        return result


class EmissionData:
    """Class that stores the emission and climate data of the server."""

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
        """Return the last t ticks of the data."""
        result = defaultdict(lambda: defaultdict(dict))
        for category, subcategories in self._data.items():
            for subcategory, buffer in subcategories.items():
                result[category][subcategory] = list(buffer)[-t:]
        return result

    def add(self, key, value):
        """Add a value to the data. Increasing the CO2 levels."""
        self._data["emissions"][key][-1] += value

    def init_new_value(self):
        """Generate the new values for CO2, reference temperature and temperature deviation."""
        # Keeping the CO2 levels form one tick to the next
        self._data["emissions"]["CO2"].append(self._data["emissions"]["CO2"][-1])
        # Calculating new temperatures
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
        """Return the last value for each subcategory."""
        last_values = {}
        for category, subcategories in self._data.items():
            last_values[category] = {}
            for subcategory, values in subcategories.items():
                last_values[category][subcategory] = values[-1]
        return last_values

    def get_co2(self):
        """Return the last value of the CO2 levels."""
        return self._data["emissions"]["CO2"][-1]


def calculate_reference_gta(tick, seconds_per_tick):
    """Calculate the server's reference global average temperature."""
    month = tick * seconds_per_tick / 518_400
    return 13.65 - math.sin((month + 2) * math.pi / 6) * 1.9


def calculate_temperature_deviation(tick, seconds_per_tick, co2_levels, random_seed):
    """Calculate the GAT deviation from the CO2 levels."""
    ticks_per_year = 60 * 60 * 24 * 72 / seconds_per_tick
    temperature_deviation = (co2_levels - 4e10) / 1.33e10
    perlin1 = noise.pnoise1(tick / ticks_per_year, base=random_seed)
    perlin2 = noise.pnoise1(tick / ticks_per_year * 6, base=random_seed)
    perlin_disturbance = 0.4 * perlin1 + 0.1 * perlin2
    return temperature_deviation + perlin_disturbance
