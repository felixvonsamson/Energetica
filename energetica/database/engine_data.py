"""Module defining the classes for CapacityData, CircularBufferPlayer, CircularBufferNetwork, and EmissionData."""

from __future__ import annotations

import math
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Literal

import noise
import numpy as np

from energetica.enums import (
    ControllableFacilityType,
    ExtractionFacilityType,
    FunctionalFacilityType,
    HydroFacilityType,
    NonFacilityBidType,
    PowerFacilityType,
    RenewableFacilityType,
    StorageFacilityType,
    renewable_facility_types,
)
from energetica.game_error import GameError
from energetica.globals import engine
from energetica.schemas.networks import AskItem, AskType, BidItem, BidType
from energetica.schemas.power_priorities import PowerPriorityItem
from energetica.utils.hashing import stable_hash

if TYPE_CHECKING:
    from typing import Tuple

    from energetica.database.network import Network
    from energetica.database.player import Player


@dataclass
class NetworkPrices:
    """
    Tracks a player's renewable bids, bid prices, and ask prices by facility type.

    - `renewable_bids`: A list of renewable facilities.
    - `ask_prices`: A dictionary of controllable and storage facility types with their asking prices.
    - `bid_prices`: A dictionary of storage, extraction, and special demand facility types with their bid prices.
      (e.g., research, transport, industry and construction)

    Entries are added or removed as facilities are built or decommissioned.

    Prices are randomized so that each player's prices are slightly different. This leads to more interesting market
    dynamics, while still having reasonable default prices.
    """

    renewable_bids: list[RenewableFacilityType] = field(default_factory=list)
    ask_prices: dict[AskType, float] = field(
        default_factory=lambda: {
            ControllableFacilityType.STEAM_ENGINE: 125.0,
            ControllableFacilityType.COAL_BURNER: 600.0,
            ControllableFacilityType.GAS_BURNER: 500.0,
            ControllableFacilityType.COMBINED_CYCLE: 450.0,
            ControllableFacilityType.NUCLEAR_REACTOR: 275.0,
            ControllableFacilityType.NUCLEAR_REACTOR_GEN4: 375.0,
            StorageFacilityType.SMALL_PUMPED_HYDRO: 790.0,
            StorageFacilityType.MOLTEN_SALT: 830.0,
            StorageFacilityType.LARGE_PUMPED_HYDRO: 780.0,
            StorageFacilityType.HYDROGEN_STORAGE: 880.0,
            StorageFacilityType.LITHIUM_ION_BATTERIES: 940.0,
            StorageFacilityType.SOLID_STATE_BATTERIES: 900.0,
        },
    )
    bid_prices: dict[BidType, float] = field(
        default_factory=lambda: {
            FunctionalFacilityType.INDUSTRY: 1000.0,
            NonFacilityBidType.CONSTRUCTION: 1020.0,
            NonFacilityBidType.RESEARCH: 1200.0,
            NonFacilityBidType.TRANSPORT: 1050.0,
            ExtractionFacilityType.COAL_MINE: 960.0,
            ExtractionFacilityType.GAS_DRILLING_SITE: 980.0,
            ExtractionFacilityType.URANIUM_MINE: 990.0,
            FunctionalFacilityType.CARBON_CAPTURE: 660.0,
            StorageFacilityType.SMALL_PUMPED_HYDRO: 210.0,
            StorageFacilityType.MOLTEN_SALT: 190.0,
            StorageFacilityType.LARGE_PUMPED_HYDRO: 200.0,
            StorageFacilityType.HYDROGEN_STORAGE: 230.0,
            StorageFacilityType.LITHIUM_ION_BATTERIES: 425.0,
            StorageFacilityType.SOLID_STATE_BATTERIES: 420.0,
        },
    )

    def init_prices_with_randomness(self, player: Player) -> None:
        """Initialize the prices of the player with added random values."""
        for ask_name in self.ask_prices:
            seed_hash = stable_hash((engine.random_seed, "bid", ask_name, player.id))
            rng = np.random.default_rng(abs(seed_hash))
            added_randomness = rng.uniform(-15, 15)
            self.ask_prices[ask_name] += added_randomness

        for bid_name in self.bid_prices:
            seed_hash = stable_hash((engine.random_seed, "ask", bid_name, player.id))
            rng = np.random.default_rng(abs(seed_hash))
            added_randomness = rng.uniform(-15, 15)
            self.bid_prices[bid_name] += added_randomness

    def update(
        self,
        *,
        updated_asks: dict[AskType, float],
        updated_bids: dict[BidType, float],
    ) -> None:
        """Update the prices of the player for each facility type."""
        self.bid_prices |= updated_bids
        self.ask_prices |= updated_asks

    AskBid = Literal["ask", "bid"]  # Helper type

    def get_sorted_renewables(self) -> list[RenewableFacilityType]:
        """Return the player's renewable bids sorted by price."""
        self.renewable_bids.sort(key=renewable_facility_types.index)
        return self.renewable_bids

    def get_facility_priorities(self, player: Player) -> list[PowerPriorityItem]:
        """Return the player's priority lists containing asks and bids but not renewables, sorted by price."""
        type_key_price: list[Tuple[PowerPriorityItem, float]] = []

        for key, price in self.ask_prices.items():
            if key not in player.capacities or player.capacities[key]["power"] == 0:
                continue
            type_key_price.append((AskItem(side="ask", type=key), price))

        for key, price in self.bid_prices.items():
            if isinstance(key, StorageFacilityType):
                if key not in player.capacities or player.capacities[key]["power"] == 0:
                    continue
            elif isinstance(key, ExtractionFacilityType):
                if key not in player.capacities or player.capacities[key]["power_use"] == 0:
                    continue
            elif isinstance(key, FunctionalFacilityType):
                # This covers industry and carbon capture. Industry should always have lvl > 0
                if player.functional_facility_lvl[key] == 0:
                    continue
            elif key == NonFacilityBidType.RESEARCH:
                if player.functional_facility_lvl[FunctionalFacilityType.LABORATORY] == 0:
                    continue
            elif key == NonFacilityBidType.TRANSPORT:
                if player.functional_facility_lvl[FunctionalFacilityType.WAREHOUSE] == 0:
                    continue
            type_key_price.append((BidItem(side="bid", type=key), price))

        type_key_price.sort(key=lambda x: x[1])
        return [x[0] for x in type_key_price]

    def change_facility_priority(self, player: Player, new_priority: list[PowerPriorityItem]) -> None:
        """
        Reassign the selling prices of the facilities according to the new priority order.

        Executed when the facilities priority is changed by changing the order in the interactive table for players
        that are not in a network.
        """
        # Check if the new priority list is valid, i.e. contains the same elements as the old one
        old_priority = self.get_facility_priorities(player)
        if set(old_priority) != set(new_priority):
            raise GameError("malformedRequest")

        # Reorder the prices according to the new priority list
        sorted_prices = sorted(
            [
                self.bid_prices[item.type] if item.side == "bid" else self.ask_prices[item.type]
                for item in old_priority
                if item.side in {"bid", "ask"}
            ],
        )
        updated_bid_prices = {}
        updated_ask_prices = {}
        for item, price in zip(new_priority, sorted_prices):
            if item.side == "ask":
                updated_ask_prices[item.type] = price
            else:
                updated_bid_prices[item.type] = price

        self.update(updated_asks=updated_ask_prices, updated_bids=updated_bid_prices)


class CapacityData:
    """
    Class that stores precalculated maximum values per facility type of a player according to its active facilities.

    The data structure is as follows:
    {
        [facility_type]: {
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

    def __init__(self) -> None:
        # TODO (Yassir): Add ref to the player in init
        self._data: dict[str, dict] = {}

    def update(
        self,
        player: Player,
        facility_type: PowerFacilityType | StorageFacilityType | ExtractionFacilityType | None,
    ) -> None:
        """Update the capacity data of the player."""
        from energetica.database.active_facility import ActiveFacility

        active_facilities: list[ActiveFacility]
        if facility_type is None:
            active_facilities = list(ActiveFacility.filter_by(player=player))
            unique_facilities = {af.facility_type for af in active_facilities}
            for uf in unique_facilities:
                self.init_facility(uf)
        else:
            active_facilities = list(ActiveFacility.filter_by(player=player, facility_type=facility_type))
            if len(active_facilities) == 0 and facility_type in self._data:
                del self._data[facility_type]
                return
            self.init_facility(facility_type)

        for facility in active_facilities:
            base_data = engine.const_config["assets"][facility.facility_type]
            effective_values = self._data[facility.facility_type]
            op_costs = facility.daily_op_cost * engine.in_game_seconds_per_tick / (24 * 3600)
            if isinstance(facility.facility_type, HydroFacilityType):
                op_costs *= facility.multipliers["hydro_price_multiplier"]
            effective_values["O&M_cost"] += op_costs
            if isinstance(facility.facility_type, PowerFacilityType):
                power_gen = facility.max_power_generation
                effective_values["power"] += power_gen
                for fuel in effective_values["fuel_use"]:
                    # if effective_values["fuel_use"] is not None, then it is a controllable facility
                    effective_values["fuel_use"][fuel] += (
                        base_data["consumed_resource"][fuel]
                        / facility.multipliers["efficiency_multiplier"]
                        * power_gen
                        * engine.in_game_seconds_per_tick
                        / 3600
                        / 1_000_000
                    )
            elif isinstance(facility.facility_type, StorageFacilityType):
                power_gen = facility.max_power_generation
                # mean efficiency
                effective_values["efficiency"] = (
                    (effective_values["efficiency"] * effective_values["power"])
                    + (base_data["base_efficiency"] * facility.multipliers["efficiency_multiplier"] * power_gen)
                ) / (effective_values["power"] + power_gen)
                effective_values["power"] += power_gen
                if facility.end_of_life > 0:
                    effective_values["capacity"] += facility.storage_capacity
            elif isinstance(facility.facility_type, ExtractionFacilityType):
                effective_values["extraction_rate_per_day"] += (
                    base_data["base_extraction_rate_per_day"] * facility.multipliers["extraction_rate_multiplier"]
                )
                effective_values["power_use"] += (
                    base_data["base_power_consumption"] * facility.multipliers["power_consumption_multiplier"]
                )
                effective_values["pollution"] += (
                    base_data["base_pollution"] * facility.multipliers["extraction_emissions_multiplier"]
                )

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
        if isinstance(facility, PowerFacilityType):
            self._data[facility] = {"O&M_cost": 0.0, "power": 0.0, "fuel_use": {}}
            for resource in const_config[facility]["consumed_resource"]:
                if const_config[facility]["consumed_resource"][resource] > 0:
                    self._data[facility]["fuel_use"][resource] = 0.0
            return
        if isinstance(facility, StorageFacilityType):
            self._data[facility] = {"O&M_cost": 0.0, "power": 0.0, "capacity": 0.0, "efficiency": 0.0}
            return
        if isinstance(facility, ExtractionFacilityType):
            self._data[facility] = {"O&M_cost": 0.0, "extraction_rate_per_day": 0.0, "power_use": 0.0, "pollution": 0.0}

    def __getitem__(self, facility: str) -> dict:
        """Return the capacity data of a facility."""
        return self._data[facility]

    def get(self, facility: str) -> dict | None:
        """Return the capacity data of a facility."""
        return self._data.get(facility)

    def get_all(self) -> dict[str, dict]:
        """Return the capacity data."""
        return self._data

    def __contains__(self, facility: str) -> bool:
        """Return true if the facility is in the capacity data."""
        return facility in self._data


class CircularBufferPlayer:
    """Class that stores the active data of a player (last 360 ticks of the graph data)."""

    def __init__(self) -> None:
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

    def append_value(self, new_value: dict) -> None:
        """Add one new tick of data to the buffer."""
        for category, subcategories in new_value.items():
            for subcategory, value in subcategories.items():
                self._data[category][subcategory].append(value)

    def add_subcategory(self, category: str, subcategory: str) -> None:
        """Add a new subcategory to the data."""
        if subcategory not in self._data[category]:
            self._data[category][subcategory] = deque([0.0] * 360, maxlen=360)

    def get_data(self, t: int = 216) -> dict[str, Any]:
        """Return the last t ticks of the data."""
        result: dict[str, Any] = defaultdict(lambda: defaultdict(dict))
        for category, subcategories in self._data.items():
            for subcategory, buffer in subcategories.items():
                result[category][subcategory] = list(buffer)[-t:]
        return result

    def get_last_data(self, category: str, subcategory: str) -> float:
        """Return the last value of a subcategory."""
        if category in self._data and subcategory in self._data[category]:
            return self._data[category][subcategory][-1]
        return 0

    def init_new_data(self) -> dict:
        """
        Generate the new values for the data.

        Return a dict with the same structure as the data with 0 and with the last value for the storage and resources.
        """
        result: dict[str, Any] = {}
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

    def __init__(self) -> None:
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

    def __getitem__(self, facility: str) -> float | None:
        """Return the data of a facility."""
        if facility not in self._data:
            return None
        return self._data[facility]

    def get_all(self) -> dict[str, float]:
        """Return the data."""
        return self._data


class CircularBufferNetwork:
    """Class that stores the active data of a Network."""

    def __init__(self) -> None:
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

    def append_value(self, new_value: dict) -> None:
        """Add one new tick of data to the buffer."""
        for category, category_value in self._data.items():
            for group, value in new_value[category].items():
                if group not in category_value:
                    category_value[group] = deque([0.0] * 360, maxlen=360)
                category_value[group].append(value)
            for group, value in category_value.items():
                if group not in new_value[category]:
                    value.append(0.0)

    def get_data(self, t: int = 216) -> dict[str, dict]:
        """Return the last t ticks of the data."""
        result: dict[str, dict] = defaultdict(lambda: defaultdict(dict))
        for category, value in self._data.items():
            for group, buffer in value.items():
                result[category][group] = list(buffer)[-t:]
        return result


class EmissionData:
    """Class that stores the emission and climate data of the server."""

    def __init__(self, delta_t: int, spt: int, random_seed: int) -> None:
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

    def get_data(self, t: int = 216) -> dict[str, dict]:
        """Return the last t ticks of the data."""
        result: dict[str, dict] = defaultdict(lambda: defaultdict(dict))
        for category, subcategories in self._data.items():
            for subcategory, buffer in subcategories.items():
                result[category][subcategory] = list(buffer)[-t:]
        return result

    def add(self, key: str, value: float) -> None:
        """Add a value to the data. Increasing the CO2 levels."""
        self._data["emissions"][key][-1] += value

    def init_new_value(self) -> None:
        """Generate the new values for CO2, reference temperature and temperature deviation."""
        # Keeping the CO2 levels form one tick to the next
        self._data["emissions"]["CO2"].append(self._data["emissions"]["CO2"][-1])
        # Calculating new temperatures
        t = engine.total_t + engine.delta_t
        self._data["temperature"]["reference"].append(calculate_reference_gta(t, engine.in_game_seconds_per_tick))
        self._data["temperature"]["deviation"].append(
            calculate_temperature_deviation(
                t,
                engine.in_game_seconds_per_tick,
                self._data["emissions"]["CO2"][0],
                engine.random_seed,
            ),
        )

    def get_last_data(self) -> dict[str, dict]:
        """Return the last value for each subcategory."""
        last_values: dict[str, dict] = {}
        for category, subcategories in self._data.items():
            last_values[category] = {}
            for subcategory, values in subcategories.items():
                last_values[category][subcategory] = values[-1]
        return last_values

    def get_co2(self) -> float:
        """Return the last value of the CO2 levels."""
        return self._data["emissions"]["CO2"][-1]


def calculate_reference_gta(tick: int, seconds_per_tick: int) -> float:
    """Calculate the server's reference global average temperature."""
    month = tick * seconds_per_tick / 518_400
    return 13.65 - math.sin((month + 2) * math.pi / 6) * 1.9


def calculate_temperature_deviation(tick: int, seconds_per_tick: int, co2_levels: float, random_seed: int) -> float:
    """Calculate the GAT deviation from the CO2 levels."""
    ticks_per_year = 60 * 60 * 24 * 72 / seconds_per_tick
    temperature_deviation = (co2_levels - 4e10) / 1.33e10
    perlin1 = noise.pnoise1(tick / ticks_per_year, base=random_seed)
    perlin2 = noise.pnoise1(tick / ticks_per_year * 6, base=random_seed)
    perlin_disturbance = 0.4 * perlin1 + 0.1 * perlin2
    return temperature_deviation + perlin_disturbance
