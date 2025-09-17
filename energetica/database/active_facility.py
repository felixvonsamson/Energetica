"""Contains the ActiveFacility class."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from energetica import technology_effects
from energetica.schemas.config.extraction_facility import ExtractionFacilityConfig
from energetica.schemas.config.power_facility import PowerFacilityConfig
from energetica.schemas.config.storage_facility import StorageFacilityConfig
from energetica.database import DBModel
from energetica.enums import ExtractionFacilityType, HydroFacilityType, PowerFacilityType, StorageFacilityType
from energetica.globals import engine

if TYPE_CHECKING:
    from energetica.database.player import Player


@dataclass
class ActiveFacility(DBModel):
    """Class that stores the facilities on the server and their end of life time."""

    facility_type: PowerFacilityType | StorageFacilityType | ExtractionFacilityType
    player: Player
    position: tuple[float, float]
    end_of_life: float

    # multiply the base values by the following values
    multipliers: dict[str, float]

    # percentage of the facility that is currently used
    usage: float = 0.0

    cut_out_speed_exceeded: bool = False

    @property
    def decommissioning(self) -> bool:
        """Returns True if the facility is being decommissioned."""
        return self.end_of_life <= engine.total_t

    @property
    def new_config(self) -> PowerFacilityConfig | StorageFacilityConfig | ExtractionFacilityConfig:
        """The current configuration of the facility, including tech upgrades."""
        if isinstance(self.facility_type, PowerFacilityType):
            return engine.config.power_facilities[self.facility_type]
        elif isinstance(self.facility_type, StorageFacilityType):
            return engine.config.storage_facilities[self.facility_type]
        elif isinstance(self.facility_type, ExtractionFacilityType):
            return engine.config.extraction_facilities[self.facility_type]
        raise ValueError("Invalid facility type")

    @property
    def display_name(self) -> str:
        """The name of the facility."""
        return self.new_config.name

    @property
    def real_base_cost(self) -> float:
        """
        The base cost of the facility.

        This is the cost without any upgrades, but including the special_price_multiplier for hydro facilities.
        """
        if isinstance(self.facility_type, HydroFacilityType):
            return self.new_config.base_price * self.multipliers["hydro_price_multiplier"]
        return self.new_config.base_price

    @property
    def total_cost(self) -> float:
        """Total cost of the facility, including all upgrades."""
        return self.real_base_cost * self.multipliers["price_multiplier"]

    @property
    def max_power_generation(self) -> float:
        """Max power output of the facility in W."""
        if not isinstance(self.new_config, (PowerFacilityConfig, StorageFacilityConfig)):
            raise ValueError("Max power generation is only defined for power and storage facilities")
        return self.new_config.base_power_generation * self.multipliers["power_production_multiplier"]

    @property
    def storage_capacity(self) -> float:
        """Storage capacity of the facility in Wh."""
        if not isinstance(self.new_config, StorageFacilityConfig):
            raise ValueError("Storage capacity is only defined for storage facilities")
        return self.new_config.base_storage_capacity * self.multipliers["capacity_multiplier"]

    @property
    def extraction_rate(self) -> float:
        """Rate at which the facility extracts resources from the ground. Defined only for extraction facilities."""
        if not (
            isinstance(self.facility_type, ExtractionFacilityType)
            and isinstance(self.new_config, ExtractionFacilityConfig)
        ):
            raise ValueError("Extraction rate is only defined for extraction facilities")
        return (
            self.new_config.base_extraction_rate_per_day
            * self.multipliers["extraction_rate_multiplier"]
            * self.player.tile.fuel_reserves[self.facility_type.associated_fuel]
            / 24
        )

    @property
    def state_of_charge(self) -> float:
        """Current charge of the facility as a percentage of maximum."""
        return min(1, self.usage)

    @property
    def efficiency(self) -> float:
        """Efficiency of the facility as a number from 0 to 1."""
        if not isinstance(self.new_config, StorageFacilityConfig):
            raise ValueError("Efficiency is only defined for storage facilities")
        return self.new_config.base_efficiency * self.multipliers["efficiency_multiplier"]

    @property
    def daily_op_cost(self) -> float:
        """Cost to operate the facility per in-game day."""
        return self.total_cost * self.new_config.o_and_m_factor_per_day

    @property
    def hourly_op_cost(self) -> float:
        """Cost to operate the facility per in-game hour."""
        return self.daily_op_cost / 24

    @property
    def max_power_use(self) -> float:
        """Maximum power consumption of the facility in W. Defined only for extraction facilities."""
        if not isinstance(self.new_config, ExtractionFacilityConfig):
            raise ValueError("Max power use is only defined for extraction facilities")
        return self.new_config.base_power_consumption * self.multipliers["power_consumption_multiplier"]

    @property
    def remaining_lifespan(self) -> float | None:
        """Time left until the facility is decommissioned in ticks."""
        remaining_ticks = self.end_of_life - engine.total_t
        if remaining_ticks < 0:
            return None
        return remaining_ticks

    @property
    def is_upgradable(self) -> bool:
        """
        Whether the facility can be upgraded.

        Returns true if any of the attributes of the facility are outdated compared to current tech levels.
        This method is undefined for technologies and for functional facilities.
        When decommissioning storage facilities, these must first be emptied. In this state, they cannot be upgraded.
        """
        if self.decommissioning:
            return False
        for multiplier_name, multiplier in self.multipliers.items():
            if (
                multiplier_name == "next_available_location"
                or multiplier_name == "hydro_price_multiplier"
                or multiplier_name == "wind_speed_multiplier"
            ):
                continue
            new_multiplier = technology_effects.current_multiplier(self.player, multiplier_name, self.facility_type)
            # Note: The following check relies on multipliers only ever increasing
            if multiplier < new_multiplier:
                return True
        return False

    @property
    def upgrade_cost(self) -> float | None:
        """Cost to upgrade the facility."""
        if not self.is_upgradable:
            return None
        price_multiplier_diff = (
            technology_effects.price_multiplier(self.player, self.facility_type) - self.multipliers["price_multiplier"]
        )
        # Some technologies reduce the cost of the facility, but we still want upgrades to cost something
        # TODO: rethink this
        price_multiplier_diff = max(price_multiplier_diff, 0.05)
        return self.real_base_cost * price_multiplier_diff

    @property
    def dismantle_cost(self) -> float:
        """Cost to dismantle the facility."""
        return self.total_cost * 0.2
