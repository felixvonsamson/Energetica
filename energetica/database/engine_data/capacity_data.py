"""Module for the CapacityData class."""

from __future__ import annotations

from typing import TYPE_CHECKING

from energetica.enums import ExtractionFacilityType, HydroFacilityType, PowerFacilityType, StorageFacilityType
from energetica.globals import engine

if TYPE_CHECKING:
    from energetica.database.network import Network
    from energetica.database.player import Player


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
            effective_values = self._data[facility.facility_type]
            op_costs = facility.daily_op_cost * engine.in_game_seconds_per_tick / (24 * 3600)
            if isinstance(facility.facility_type, HydroFacilityType):
                op_costs *= facility.multipliers["hydro_price_multiplier"]
            effective_values["O&M_cost"] += op_costs
            if isinstance(facility.facility_type, PowerFacilityType):
                base_data = engine.config.power_facilities[facility.facility_type]
                power_gen = facility.max_power_generation
                effective_values["power"] += power_gen
                for fuel in effective_values["fuel_use"]:
                    # if effective_values["fuel_use"] is not None, then it is a controllable facility
                    effective_values["fuel_use"][fuel] += (
                        base_data.consumed_resources[fuel]
                        / facility.multipliers["efficiency_multiplier"]
                        * power_gen
                        * engine.in_game_seconds_per_tick
                        / 3600
                        / 1_000_000
                    )
            elif isinstance(facility.facility_type, StorageFacilityType):
                base_data = engine.config.storage_facilities[facility.facility_type]
                power_gen = facility.max_power_generation
                # mean efficiency
                effective_values["efficiency"] = (
                    (effective_values["efficiency"] * effective_values["power"])
                    + (base_data.base_efficiency * facility.multipliers["efficiency_multiplier"] * power_gen)
                ) / (effective_values["power"] + power_gen)
                effective_values["power"] += power_gen
                if facility.end_of_life > 0:
                    effective_values["capacity"] += facility.storage_capacity
            elif isinstance(facility.facility_type, ExtractionFacilityType):
                base_data = engine.config.extraction_facilities[facility.facility_type]
                effective_values["extraction_rate_per_day"] += (
                    base_data.base_extraction_rate_per_day * facility.multipliers["extraction_rate_multiplier"]
                )
                effective_values["power_use"] += (
                    base_data.base_power_consumption * facility.multipliers["power_consumption_multiplier"]
                )
                effective_values["pollution"] += (
                    base_data.base_pollution * facility.multipliers["extraction_emissions_multiplier"]
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
        if isinstance(facility, PowerFacilityType):
            self._data[facility] = {"O&M_cost": 0.0, "power": 0.0, "fuel_use": {}}
            for resource in engine.config.power_facilities[facility].consumed_resources:
                if engine.config.power_facilities[facility].consumed_resources[resource] > 0:
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
