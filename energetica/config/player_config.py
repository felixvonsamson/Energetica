"""PlayerConfig class and related helper function."""

from __future__ import annotations
from typing import TYPE_CHECKING

from energetica.enums import Fuel, FunctionalFacilityType, TechnologyType, WorkerType

from energetica.globals import engine

if TYPE_CHECKING:
    from energetica.database.player import Player


def warehouse_capacity_for_level(warehouse_level: int, fuel: Fuel) -> float | None:
    """Return the capacity in kg of the specified resource for a warehouse of a specified level."""
    if warehouse_level == 0:
        return None
    else:
        return (
            engine.new_config.functional_facilities.warehouse.capacities[fuel]
            * engine.new_config.functional_facilities.warehouse.capacity_factor**warehouse_level
        )


class PlayerConfig(object):
    """Config object that contains the modified data for a specific player considering the technologies he owns."""

    def __init__(self, player: Player) -> None:
        """Update the config values according to the players technology level."""
        # calculating industry energy consumption and income
        self.industry_power_consumption = (
            engine.new_config.functional_facilities.industry.base_power_consumption
            * engine.new_config.functional_facilities.industry.power_factor
            ** player.functional_facility_lvl[FunctionalFacilityType.INDUSTRY]
        )
        self.industry_income_per_day = (
            engine.new_config.functional_facilities.industry.base_income_per_day
            * engine.new_config.functional_facilities.industry.income_factor
            ** player.functional_facility_lvl[FunctionalFacilityType.INDUSTRY]
        )
        # basic universal income of 540 per in-game day
        self.industry_income_per_day += engine.new_config.functional_facilities.industry.universal_income_per_day

        # calculating carbon capture power consumption and CO2 absorption
        self.carbon_capture_power_consumption = (
            engine.new_config.functional_facilities.carbon_capture.base_power_consumption
            * engine.new_config.functional_facilities.carbon_capture.power_factor
            ** player.functional_facility_lvl[FunctionalFacilityType.CARBON_CAPTURE]
        )
        self.carbon_capture_absorption = (
            engine.new_config.functional_facilities.carbon_capture.base_absorption_per_day
            * engine.new_config.functional_facilities.carbon_capture.absorption_factor
            ** player.functional_facility_lvl[FunctionalFacilityType.CARBON_CAPTURE]
        )

        # calculating the maximum storage capacity from the warehouse level
        self.warehouse_capacities: dict[Fuel, float] = {}
        for resource in engine.new_config.functional_facilities.warehouse.capacities:
            self.warehouse_capacities[resource] = (
                warehouse_capacity_for_level(player.functional_facility_lvl[FunctionalFacilityType.WAREHOUSE], resource)
                or 0.0
            )

        # calculating the transport speed and energy consumption from the level of transport technology
        self.transport_time_per_tile = (
            engine.new_config.functional_facilities.warehouse.time_per_tile
            * engine.new_config.technologies.transport_technology.time_factor
            ** player.technology_lvl[TechnologyType.TRANSPORT_TECHNOLOGY]
        )
        self.transport_power_per_kg = (
            engine.new_config.functional_facilities.warehouse.energy_per_kg_per_tile
            * engine.new_config.technologies.transport_technology.energy_factor
            ** player.technology_lvl[TechnologyType.TRANSPORT_TECHNOLOGY]
            * 3600
            / self.transport_time_per_tile
        )

        # setting the number of workers
        player.workers = {
            WorkerType.CONSTRUCTION: WorkerType.construction_workers_for_level(
                player.technology_lvl[TechnologyType.BUILDING_TECHNOLOGY],
            ),
            WorkerType.RESEARCH: WorkerType.lab_workers_for_level(
                player.functional_facility_lvl[FunctionalFacilityType.LABORATORY],
            ),
        }
