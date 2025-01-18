"""Contains the ActiveFacility class."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from energetica import technology_effects
from energetica.config.assets import const_config
from energetica.database import DBModel
from energetica.enums import (
    ControllableFacilityType,
    ExtractionFacilityType,
    PowerFacilityType,
    StorageFacilityType,
)
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
    multipliers: dict[str, float] = field(default_factory=dict)

    # percentage of the facility that is currently used
    usage: float = 0.0

    cut_out_speed_exceeded: bool = False

    @property
    def decommissioning(self) -> bool:
        """Returns True if the facility is being decommissioned."""
        return self.end_of_life <= engine.data["total_t"]

    @property
    def const_config(self) -> dict:
        """The base configuration of the facility."""
        return const_config["assets"][self.facility_type]

    @property
    def display_name(self) -> str:
        """The name of the facility."""
        return self.const_config["name"]

    @property
    def real_base_cost(self) -> float:
        """The base cost of the facility.

        This is the cost without any upgrades, but including the special_price_multiplier for hydro facilities.
        """
        if self.facility_type in ["watermill", "small_water_dam", "large_water_dam"]:
            return self.const_config["base_price"] * self.multipliers["multiplier_2"]
        return self.const_config["base_price"]

    @property
    def total_cost(self) -> float:
        """Total cost of the facility, including all upgrades."""
        return self.real_base_cost * self.multipliers["price_multiplier"]

    @property
    def max_power_generation(self) -> float:
        """Max power output of the facility in W."""
        return self.const_config["base_power_generation"] * self.multipliers["multiplier_1"]

    @property
    def storage_capacity(self) -> float:
        """Storage capacity of the facility in Wh."""
        return self.const_config["base_storage_capacity"] * self.multipliers["multiplier_2"]

    @property
    def extraction_rate(self) -> float:
        """Rate at which the facility extracts resources from the ground. Defined only for extraction facilities."""
        assert self.player.tile is not None
        assert isinstance(self.facility_type, ExtractionFacilityType)
        return (
            self.const_config["base_extraction_rate_per_day"]
            * self.multipliers["multiplier_2"]
            * self.player.tile.fuel_reserves[self.facility_type.associated_fuel]
            / 24
        )

    @property
    def state_of_charge(self) -> float:
        """Current charge of the facility as a percentage of maximum."""
        return self.usage

    @property
    def efficiency(self) -> float:
        """Efficiency of the facility as a number from 0 to 1."""
        return self.const_config["base_efficiency"] * self.multipliers["multiplier_3"]

    @property
    def daily_op_cost(self) -> float:
        """Cost to operate the facility per in-game day."""
        return self.total_cost * self.const_config["O&M_factor_per_day"]

    @property
    def hourly_op_cost(self) -> float:
        """Cost to operate the facility per in-game hour."""
        return self.daily_op_cost / 24

    @property
    def max_power_use(self) -> float:
        """Maximum power consumption of the facility in W. Defined only for extraction facilities."""
        return self.const_config["base_power_consumption"] * self.multipliers["multiplier_1"]

    @property
    def remaining_lifespan(self) -> int | None:
        """Time left until the facility is decommissioned in ticks."""
        remaining_ticks = self.end_of_life - engine.data["total_t"]
        if remaining_ticks < 0:
            return None
        return remaining_ticks

    @property
    def is_upgradable(self) -> bool:
        """Whether the facility can be upgraded.

        Returns true if any of the attributes of the facility are outdated compared to current tech levels.
        This method is undefined for technologies and for functional facilities.
        """
        if self.multipliers["price_multiplier"] < technology_effects.price_multiplier(self.player, self.facility_type):
            return True
        if self.facility_type in ExtractionFacilityType:
            return (
                self.multipliers["multiplier_1"] < technology_effects.multiplier_1(self.player, self.facility_type)
                or self.multipliers["multiplier_2"] < technology_effects.multiplier_2(self.player, self.facility_type)
                or self.multipliers["multiplier_3"] < technology_effects.multiplier_3(self.player, self.facility_type)
            )
        # power & storage facilities
        return (
            (
                # self.name in power_facilities + storage_facilities
                isinstance(self.facility_type, PowerFacilityType | StorageFacilityType)
                # self.name in PowerFacility
                # self.name in (*power_facility_types, *StorageFacility)
                and self.multipliers["multiplier_1"] < technology_effects.multiplier_1(self.player, self.facility_type)
            )
            or (
                isinstance(self.facility_type, StorageFacilityType)
                and self.multipliers["multiplier_2"] < technology_effects.multiplier_2(self.player, self.facility_type)
            )
            or (
                # self.name in controllable_facilities + storage_facilities
                isinstance(self.facility_type, ControllableFacilityType | StorageFacilityType)
                and self.multipliers["multiplier_3"] < technology_effects.multiplier_3(self.player, self.facility_type)
            )
        )

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
