"""Contains the ActiveFacility class."""

from typing import TYPE_CHECKING

from flask import current_app

from energetica import technology_effects
from energetica.config.assets import const_config
from energetica.database import db

if TYPE_CHECKING:
    from energetica.database.player import Player
    from energetica.game_engine import GameEngine


class ActiveFacility(db.Model):
    """Class that stores the facilities on the server and their end of life time."""

    id = db.Column(db.Integer, primary_key=True)
    facility = db.Column(db.String(50))
    pos_x = db.Column(db.Float)
    pos_y = db.Column(db.Float)
    # time at witch the facility will be decommissioned
    end_of_life = db.Column(db.Integer)
    # multiply the base values by the following values
    price_multiplier = db.Column(db.Float)
    multiplier_1 = db.Column(db.Float)
    multiplier_2 = db.Column(db.Float)
    multiplier_3 = db.Column(db.Float)
    # percentage of the facility that is currently used
    usage = db.Column(db.Float, default=0)

    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))

    @property
    def const_config(self) -> dict:
        """The base configuration of the facility."""
        return const_config["assets"][self.facility]

    @property
    def display_name(self) -> str:
        """The name of the facility."""
        return self.const_config["name"]

    @property
    def real_base_cost(self) -> float:
        """The base cost of the facility.

        This is the cost without any upgrades, but including the special_price_multiplier for hydro facilities.
        """
        if self.facility in ["watermill", "small_water_dam", "large_water_dam"]:
            return self.const_config["base_price"] * self.multiplier_2
        return self.const_config["base_price"]

    @property
    def total_cost(self) -> float:
        """Total cost of the facility, including all upgrades."""
        return self.real_base_cost * self.price_multiplier

    @property
    def installed_cap(self) -> float:
        """Max power output of the facility in W."""
        return self.const_config["base_power_generation"] * self.multiplier_1

    @property
    def storage_capacity(self) -> float:
        """Storage capacity of the facility in Wh."""
        return self.const_config["base_storage_capacity"] * self.multiplier_2

    @property
    def extraction_rate(self) -> float:
        """Rate at which the facility extracts resources from the ground. Defined only for extraction facilities."""
        player: Player = self.player
        extraction_to_resource = {
            "coal_mine": "coal",
            "gas_drilling_site": "gas",
            "uranium_mine": "uranium",
        }
        return (
            self.const_config["base_extraction_rate_per_day"]
            * self.multiplier_2
            * player.get_reserves()[extraction_to_resource[self.facility]]
            / 24
        )

    @property
    def state_of_charge(self) -> float:
        """Current charge of the facility as a percentage of maximum."""
        return self.usage

    @property
    def efficiency(self) -> float:
        """Efficiency of the facility as a number from 0 to 1."""
        return self.const_config["base_efficiency"] * self.multiplier_3

    @property
    def op_cost(self) -> float:
        """Cost to operate the facility per in-game hour."""
        return self.total_cost * self.const_config["O&M_factor_per_day"] / 24

    @property
    def max_power_use(self) -> float:
        """Maximum power consumption of the facility in W. Defined only for extraction facilities."""
        return self.const_config["base_power_consumption"] * self.multiplier_1

    @property
    def remaining_lifespan(self) -> int:
        """Time left until the facility is decommissioned in ticks."""
        engine: GameEngine = current_app.config["engine"]
        return self.end_of_life - engine.data["total_t"]

    @property
    def is_upgradable(self) -> bool:
        """Whether the facility can be upgraded.

        Returns true if any of the attributes of the facility are outdated compared to current tech levels.
        This method is undefined for technologies and for functional facilities.
        """
        engine: GameEngine = current_app.config["engine"]
        if self.price_multiplier < technology_effects.price_multiplier(self.player, self.facility):
            return True
        if self.facility in engine.extraction_facilities:
            return (
                self.multiplier_1 < technology_effects.multiplier_1(self.player, self.facility)
                or self.multiplier_2 < technology_effects.multiplier_2(self.player, self.facility)
                or self.multiplier_3 < technology_effects.multiplier_3(self.player, self.facility)
            )
        # power & storage facilities
        return (
            (
                self.facility in engine.power_facilities + engine.storage_facilities
                and self.multiplier_1 < technology_effects.multiplier_1(self.player, self.facility)
            )
            or (
                self.facility in engine.storage_facilities
                and self.multiplier_2 < technology_effects.multiplier_2(self.player, self.facility)
            )
            or (
                self.facility in engine.controllable_facilities + engine.storage_facilities
                and self.multiplier_3 < technology_effects.multiplier_3(self.player, self.facility)
            )
        )

    @property
    def upgrade_cost(self) -> int | None:
        """Cost to upgrade the facility."""
        if not self.is_upgradable:
            return None
        price_multiplier_diff = technology_effects.price_multiplier(self.player, self.facility) - self.price_multiplier
        # Some technologies reduce the cost of the facility, but we still want upgrades to cost something
        # TODO: rethink this
        price_multiplier_diff = max(price_multiplier_diff, 0.05)
        return self.real_base_cost * price_multiplier_diff

    @property
    def dismantle_cost(self) -> float:
        """Cost to dismantle the facility."""
        return self.total_cost * 0.2
