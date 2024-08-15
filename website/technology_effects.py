"""
This files contains all the functions to calculate the different parameters of facilities according to the technology
levels of the player.
"""

import math
from typing import Dict, List

from flask import current_app

from website.config.assets import (
    player_construction_workers_for_level,
    player_lab_workers_for_level,
    warehouse_capacity_for_level,
)
from website.database.map import Hex
from website.database.player import Player
from website.game_engine import GameEngine

from .database.player_assets import ActiveFacility, OngoingConstruction

# This dictionary describes what multipliers are stored where.
# See also the docstring for the individual multiplier functions.
# {
#     "power_production_multiplier": "multiplier_1",
#     "power_consumption_multiplier": "multiplier_1",
#     "capacity_multiplier": "multiplier_2",
#     "wind_speed_multiplier": "multiplier_2",
#     "hydro_price_multiplier": "multiplier_2",
#     "extraction_rate_multiplier": "multiplier_2",
#     "efficiency_multiplier": "multiplier_3",
#     "next_available_location": "multiplier_3",
#     "extraction_emissions_multiplier": "multiplier_3",
# }


def price_multiplier(player: Player, facility) -> float:
    """Function that returns the price multiplier according to the technology level of the player."""
    const_config = current_app.config["engine"].const_config["assets"]
    mlt = 1
    # Mechanical engineering
    if facility in const_config["mechanical_engineering"]["affected_facilities"]:
        mlt *= const_config["mechanical_engineering"]["price_factor"] ** player.mechanical_engineering
    # Physics
    if facility in const_config["physics"]["affected_facilities"]:
        mlt *= const_config["physics"]["price_factor"] ** player.physics
    # Mineral extraction
    if facility in const_config["mineral_extraction"]["affected_facilities"]:
        mlt *= const_config["mineral_extraction"]["price_factor"] ** player.mineral_extraction
    # Materials
    if facility in const_config["materials"]["affected_facilities"]:
        mlt *= const_config["materials"]["price_factor"] ** player.materials
    # Civil engineering
    if facility in const_config["civil_engineering"]["affected_facilities"]:
        mlt *= const_config["civil_engineering"]["price_factor"] ** player.civil_engineering
    # Aerodynamics
    if facility in const_config["aerodynamics"]["affected_facilities"]:
        mlt *= const_config["aerodynamics"]["price_factor"] ** player.aerodynamics
    # Chemistry
    if facility in const_config["chemistry"]["affected_facilities"]:
        mlt *= const_config["chemistry"]["price_factor"] ** player.chemistry
    # Nuclear engineering
    if facility in const_config["nuclear_engineering"]["affected_facilities"]:
        mlt *= const_config["nuclear_engineering"]["price_factor"] ** player.nuclear_engineering
    # level based facilities and technologies
    engine: GameEngine = current_app.config["engine"]
    if facility in engine.functional_facilities + engine.technologies:
        mlt *= const_config[facility]["price_multiplier"] ** getattr(player, facility)
    # knowledge spilling for technologies
    if facility in engine.technologies:
        mlt *= 0.92 ** engine.data["technology_lvls"][facility][getattr(player, facility)]
    return mlt


def multiplier_1(player: Player, facility) -> float:
    """
    Returns the first multiplier according to the technology level of the player. This multiplier can be either the
    `power_production_multiplier` or the `power_consumption_multiplier`.
    """
    const_config = current_app.config["engine"].const_config["assets"]
    if facility in const_config["mineral_extraction"]["affected_facilities"]:
        return power_consumption_multiplier(player, facility)
    else:
        return power_production_multiplier(player, facility)


def power_production_multiplier(player: Player, facility: str) -> float:
    """
    Returns by how much the `facility`'s `base_power_generation` should be multiplied, according to the `player`'s
    currently researched technologies
    """
    const_config = current_app.config["engine"].const_config["assets"]
    mlt = 1
    # Mechanical engineering
    if facility in const_config["mechanical_engineering"]["affected_facilities"]:
        mlt *= const_config["mechanical_engineering"]["prod_factor"] ** player.mechanical_engineering
    # Physics
    if facility in const_config["physics"]["affected_facilities"]:
        mlt *= const_config["physics"]["prod_factor"] ** player.physics
    # Civil engineering
    if facility in const_config["civil_engineering"]["affected_facilities"]:
        mlt *= const_config["civil_engineering"]["prod_factor"] ** player.civil_engineering
    # Aerodynamics
    if facility in const_config["aerodynamics"]["affected_facilities"]:
        mlt *= const_config["aerodynamics"]["prod_factor"] ** player.aerodynamics
    # Nuclear engineering
    if facility in const_config["nuclear_engineering"]["affected_facilities"]:
        mlt *= const_config["nuclear_engineering"]["prod_factor"] ** player.nuclear_engineering
    return mlt


def power_consumption_multiplier(player: Player, facility: str) -> float:
    """
    Returns by how much the `facility`'s `base_power_consumption` should be multiplied, according to the `player`'s
    currently researched technologies
    """
    const_config = current_app.config["engine"].const_config["assets"]
    mlt = 1
    # Mineral extraction (in this case it is the energy consumption)
    if facility in const_config["mineral_extraction"]["affected_facilities"]:
        mlt += const_config["mineral_extraction"]["energy_factor"] * player.mineral_extraction
    return mlt


def multiplier_2(player: Player, facility) -> float:
    """
    Returns the second multiplier according to the technology level of the player. This multiplier can be either the
    `extraction_rate_multiplier`, the `hydro_price_multiplier`, the `wind_speed_multiplier` or the `capacity_multiplier`
    """
    const_config = current_app.config["engine"].const_config["assets"]
    if facility in const_config["mineral_extraction"]["affected_facilities"]:
        return extraction_rate_multiplier(player)
    if facility in ["watermill", "small_water_dam", "large_water_dam"]:
        return hydro_price_multiplier(player, facility)
    if facility in ["windmill", "onshore_wind_turbine", "offshore_wind_turbine"]:
        return wind_speed_multiplier(player, facility)
    return capacity_multiplier(player, facility)


def capacity_multiplier(player: Player, facility) -> float:
    """
    For storage facilities, returns by how much the `facility`'s `base_storage_capacity` should be multiplied, according
    to the `player`'s currently researched technologies
    """
    const_config = current_app.config["engine"].const_config["assets"]
    mlt = 1
    # Civil engineering
    if facility in ["small_pumped_hydro", "large_pumped_hydro"]:
        mlt *= const_config["civil_engineering"]["capacity_factor"] ** player.civil_engineering
    return mlt


def extraction_rate_multiplier(player: Player, level: int = None) -> float:
    """
    For extraction facilities, returns by how much the `facility`'s `base_extraction_rate_per_day` should be multiplied.
    If `level` is not provided, the `player`'s current `mineral_extraction` level is used.
    """
    if level is None:
        level = player.mineral_extraction
    const_config = current_app.config["engine"].const_config["assets"]
    return 1 + const_config["mineral_extraction"]["extract_factor"] * level


def hydro_price_multiplier(player: Player, facility) -> float:
    """
    For hydro power facilities, returns by how much the `facility`'s `base_price` should be multiplied, according to the
    `player`'s currently researched technologies
    """
    mlt = 1
    # calculating the hydro price multiplier linked to the number of hydro facilities
    if facility in ["watermill", "small_water_dam", "large_water_dam"]:
        mlt *= hydro_price_function(next_available_location(player, facility), player.tile.hydro)
    return mlt


def wind_speed_multiplier(player: Player, facility) -> float:
    """
    For wind power facilities, returns by how much the `facility`'s `base_power_generation` should be multiplied,
    according to the `player`'s currently researched technologies
    """
    mlt = 1
    # calculating the wind speed multiplier linked to the number of wind turbines
    if facility in ["windmill", "onshore_wind_turbine", "offshore_wind_turbine"]:
        mlt *= wind_speed_function(next_available_location(player, facility), player.tile.wind)
    return mlt


def multiplier_3(player: Player, facility) -> float:
    """
    Returns the third multiplier according to the technology level of the player. This multiplier can be either the
    `efficiency_multiplier`, the `extraction_emissions_multiplier`, or the `next_available_location`
    """
    const_config = current_app.config["engine"].const_config["assets"]
    if facility in const_config["mineral_extraction"]["affected_facilities"]:
        return extraction_emissions_multiplier(player, facility)
    if facility in [
        "watermill",
        "small_water_dam",
        "large_water_dam",
        "windmill",
        "onshore_wind_turbine",
        "offshore_wind_turbine",
    ]:
        return next_available_location(player, facility)
    return efficiency_multiplier(player, facility)


def efficiency_multiplier(player: Player, facility: str) -> float:
    """
    For storage facilities, returns by how much the `facility`'s `base_efficiency` should be multiplied, according to
    the technology level of the `player`.

    For power facilities, returns by how much the `facility`'s `base_pollution` should be multiplied, according to the
    technology level of the `player`.
    """
    const_config = current_app.config["engine"].const_config["assets"]
    # Thermodynamics
    if facility in const_config["thermodynamics"]["affected_facilities"]:
        return efficiency_multiplier_thermodynamics(player, facility)
    # Chemistry
    if facility in const_config["chemistry"]["affected_facilities"]:
        return efficiency_multiplier_chemistry(player, facility)
    return 1


def efficiency_multiplier_thermodynamics(player: Player, facility: str, level: int = None) -> float:
    """
    For facilities in the `"affected_facilities"` list for `thermodynamics`, returns the `efficiency_multiplier`.
    If `level` is not provided, the `player`'s current `thermodynamics` level is used.
    """
    if level is None:
        level = player.thermodynamics
    const_config = current_app.config["engine"].const_config["assets"]
    thermodynamic_factor = const_config["thermodynamics"]["efficiency_factor"] ** level
    if facility == "molten_salt":
        return (
            1 / const_config[facility]["initial_efficiency"] * (1 - 1 / thermodynamic_factor) + 1 / thermodynamic_factor
        )
    return thermodynamic_factor


def efficiency_multiplier_chemistry(player: Player, facility: str, level: int = None) -> float:
    """
    For facilities in the `"affected_facilities"` list for `chemistry`, returns the `efficiency_multiplier`.
    If `level` is not provided, the `player`'s current `chemistry` level is used.
    """
    if level is None:
        level = player.thermodynamics
    const_config = current_app.config["engine"].const_config["assets"]
    chemistry_factor = const_config["chemistry"]["inefficiency_factor"] ** level
    if facility == "hydrogen_storage":
        return 0.65 / const_config[facility]["initial_efficiency"] * (1 - chemistry_factor) + chemistry_factor
    return 1 / const_config[facility]["initial_efficiency"] * (1 - chemistry_factor) + chemistry_factor


def extraction_emissions_multiplier(player: Player, facility) -> float:
    """
    For extraction facilities, returns by how much the `facility`'s `base_pollution` should be multiplied, according to
    the technology level of the `player`
    """
    const_config = current_app.config["engine"].const_config["assets"]
    mlt = 1
    # Mineral extraction (in this case the the multiplier is for emissions)
    if facility in const_config["mineral_extraction"]["affected_facilities"]:
        mlt += const_config["mineral_extraction"]["pollution_factor"] * player.mineral_extraction
    return mlt


def next_available_location(player: Player, facility) -> int:
    """Finds the next available location for a hydro and wind facilities"""
    active_facilities: List[ActiveFacility] = ActiveFacility.query.filter_by(
        facility=facility, player_id=player.id
    ).all()
    under_construction: List[OngoingConstruction] = OngoingConstruction.query.filter_by(
        name=facility, player_id=player.id
    ).all()
    # Create a set of used efficiency multipliers
    used_locations = {af.multiplier_3 for af in active_facilities}
    used_locations.update(uc.multiplier_3 for uc in under_construction)
    i = 0
    while i in used_locations:
        i += 1
    return i


def construction_time(player: Player, facility):
    """Function that returns the construction time in ticks according to the technology level of the player."""
    engine: GameEngine = current_app.config["engine"]
    const_config = engine.const_config["assets"]
    # transforming in game seconds in ticks
    duration = const_config[facility]["base_construction_time"] / engine.in_game_seconds_per_tick
    # construction time increases with higher levels
    if facility in engine.functional_facilities + engine.technologies:
        duration *= const_config[facility]["price_multiplier"] ** (0.6 * getattr(player, facility))
    # knowledge spillover and laboratory time reduction
    if facility in engine.technologies:
        duration *= 0.92 ** engine.data["technology_lvls"][facility][getattr(player, facility)]
        duration *= const_config["laboratory"]["time_factor"] ** player.laboratory
    # building technology time reduction
    if (
        facility
        in engine.storage_facilities
        + engine.controllable_facilities
        + engine.renewables
        + engine.extraction_facilities
        + engine.functional_facilities
    ):
        duration *= const_config["building_technology"]["time_factor"] ** player.building_technology
    return math.ceil(duration)


def construction_power(player: Player, facility):
    """Function that returns the construction power in W according to the technology level of the player."""
    engine: GameEngine = current_app.config["engine"]
    const_config = engine.const_config["assets"]
    bt_factor = const_config["building_technology"]["time_factor"] ** player.building_technology
    # construction power in relation of facilities characteristics
    if facility in engine.power_facilities:
        # Materials (in this case it is the energy consumption for construction)
        mlt = 1
        if facility in const_config["materials"]["affected_facilities"]:
            mlt *= const_config["materials"]["construction_energy_factor"] ** player.materials
        return (
            const_config[facility]["base_power_generation"]
            * const_config[facility]["construction_power_factor"]
            * power_production_multiplier(player, facility)
            * mlt
            / bt_factor
        )
    if facility in engine.extraction_facilities:
        return (
            const_config[facility]["base_power_consumption"]
            * const_config[facility]["construction_power_factor"]
            * power_consumption_multiplier(player, facility)
            / bt_factor
        )
    if facility in engine.storage_facilities:
        return (
            const_config[facility]["base_storage_capacity"]
            * const_config[facility]["construction_power_factor"]
            * capacity_multiplier(player, facility)
            / bt_factor
        )
    power = (
        const_config[facility]["base_construction_energy"]
        / construction_time(player, facility)
        / engine.in_game_seconds_per_tick
        * 3600
    )
    # construction power increases with higher levels
    if facility in engine.functional_facilities + engine.technologies:
        power *= const_config[facility]["price_multiplier"] ** (1.2 * getattr(player, facility))
    # knowledge spillover
    if facility in engine.technologies:
        power *= 0.92 ** engine.data["technology_lvls"][facility][getattr(player, facility)]
    return power


def construction_pollution_per_tick(player: Player, facility):
    """Function that returns the construction pollution per tick according to the technology level of the player."""
    engine: GameEngine = current_app.config["engine"]
    const_config = engine.const_config["assets"]
    if facility in engine.technologies:
        return 0
    pollution = const_config[facility]["base_construction_pollution"] / construction_time(player, facility)
    # construction pollution increases with higher levels for functional facilities
    if facility in engine.functional_facilities:
        pollution *= const_config[facility]["price_multiplier"] ** getattr(player, facility)
    return pollution


def hydro_price_function(count, potential):
    """price multiplier coefficient, for the `count`th hydro facility of a particular type, given the hydro potential"""
    return 0.6 + (math.e ** (0.6 * (count + 1 - 3 * potential) / (0.3 + potential)))


def wind_speed_function(count, potential):
    """wind speed multiplier, for the `count`th wind facility of a particular type, given the wind potential"""
    return 1 / (math.log(math.e + (count * (1 / (9 * potential + 1))) ** 2))


def facility_requirements(player: Player, facility):
    """Returns the list of requirements (name, level, and boolean for met) for the specified facility"""
    const_config = current_app.config["engine"].const_config["assets"]
    requirements = const_config[facility]["requirements"].copy()
    return [
        {
            "name": requirement[0],
            "display_name": const_config[requirement[0]]["name"],
            "level": requirement[1],
            "fulfilled": getattr(player, requirement[0]) >= requirement[1],
        }
        for requirement in requirements
    ]


def requirements_met(requirements):
    """Returns True (meaning locked) if any requirements are not met, otherwise False (not locked)"""
    return any(requirement["fulfilled"] is False for requirement in requirements)


def facility_requirements_and_locked(player: Player, facility):
    """Returns a dictionary with both requirements and locked status"""
    requirements = facility_requirements(player, facility)
    locked = requirements_met(requirements)
    return {"requirements": requirements, "locked": locked}


def power_facility_resource_consumption(player: Player, power_facility):
    """Returns a dictionary of the resources consumed by the power_facility for this player"""
    # TODO: perhaps rejig how this information is packaged.
    # Namely, switch from a dictionary with the system resource name as a key and a float for the amount as a value
    # to an array of dictionaries with keys ranging in "name", "display_name", "amount"
    consumed_resources = current_app.config["engine"].const_config["assets"][power_facility]["consumed_resource"].copy()
    multiplier = efficiency_multiplier(player, power_facility)
    if multiplier == 0:
        multiplier = 1
    for resource in consumed_resources:
        consumed_resources[resource] /= multiplier
    return consumed_resources


def get_current_technology_values(player: Player):
    """Function that returns the facility values for the current technology of the player."""
    # TODO: Deprecate this function
    engine: GameEngine = current_app.config["engine"]
    dict = {}
    for facility in (
        engine.power_facilities
        + engine.storage_facilities
        + engine.extraction_facilities
        + engine.functional_facilities
    ):
        dict[facility] = {
            "price_multiplier": price_multiplier(player, facility),
            "construction_time": construction_time(player, facility),
            "construction_power": construction_power(player, facility),
            "construction_pollution": construction_pollution_per_tick(player, facility),
        }
    for facility in engine.power_facilities + engine.storage_facilities:
        dict[facility]["power_multiplier"] = power_production_multiplier(player, facility)
    for facility in engine.controllable_facilities + engine.storage_facilities:
        dict[facility]["efficiency_multiplier"] = efficiency_multiplier(player, facility)
    for facility in ["watermill", "small_water_dam", "large_water_dam"]:
        dict[facility]["special_price_multiplier"] = hydro_price_multiplier(player, facility)
    for facility in engine.storage_facilities:
        dict[facility]["capacity_multiplier"] = capacity_multiplier(player, facility)
    for facility in engine.extraction_facilities:
        dict[facility]["extraction_rate_multiplier"] = extraction_rate_multiplier(player)
        dict[facility]["power_consumption_multiplier"] = power_consumption_multiplier(player, facility)
        dict[facility]["extraction_emissions_multiplier"] = extraction_emissions_multiplier(player, facility)
    for facility in engine.technologies:
        dict[facility] = {
            "price_multiplier": price_multiplier(player, facility),
            "construction_time": construction_time(player, facility),
            "construction_power": construction_power(player, facility),
        }
        # remove fulfilled requirements
        dict[facility]["locked"] = False
        dict[facility]["requirements"] = engine.const_config["assets"][facility]["requirements"].copy()
        for req in dict[facility]["requirements"]:
            if req[1] + getattr(player, facility) < 1:
                dict[facility]["requirements"].remove(req)
                continue
            req[2] = getattr(player, req[0]) >= req[1] + getattr(player, facility)
            if not req[2]:
                dict[facility]["locked"] = True
    for facility in (
        engine.power_facilities
        + engine.storage_facilities
        + engine.functional_facilities
        + engine.extraction_facilities
    ):
        # remove fulfilled requirements
        dict[facility]["locked"] = False
        dict[facility]["requirements"] = engine.const_config["assets"][facility]["requirements"].copy()
        for req in dict[facility]["requirements"]:
            req[2] = getattr(player, req[0]) >= req[1]
            if not req[2]:
                dict[facility]["locked"] = True

    return dict


def _package_facility_base(player: Player, facility):
    """Gets data shared between power, storage, extraction, and functional facilities"""
    engine: GameEngine = current_app.config["engine"]
    const_config_assets = engine.const_config["assets"]
    return {
        "name": facility,
        "display_name": const_config_assets[facility]["name"],
        "description": const_config_assets[facility]["description"],
        "wikipedia_link": const_config_assets[facility]["wikipedia_link"],
        "price": const_config_assets[facility]["base_price"]
        * price_multiplier(player, facility)
        * (
            hydro_price_multiplier(player, facility)
            if facility in ["watermill", "small_water_dam", "large_water_dam"]
            else 1.0
        ),
        "construction_power": construction_power(player, facility),
        "construction_time": construction_time(player, facility),
        "locked": requirements_met(facility_requirements(player, facility)),
        "requirements": facility_requirements(player, facility),
    }


def _package_power_generating_facility_base(player: Player, facility):
    """Gets all data shared by power and storage facilities"""
    engine: GameEngine = current_app.config["engine"]
    const_config_assets = engine.const_config["assets"]
    return {
        "power_generation": const_config_assets[facility]["base_power_generation"]
        * power_production_multiplier(player, facility),
        "ramping_time": const_config_assets[facility]["ramping_time"]
        if const_config_assets[facility]["ramping_time"] != 0
        else None,
        "ramping_speed": const_config_assets[facility]["base_power_generation"]
        * power_production_multiplier(player, facility)
        / const_config_assets[facility]["ramping_time"]
        * 60
        if const_config_assets[facility]["ramping_time"] != 0
        else None,
    }


def _package_power_storage_extraction_facility_base(player: Player, facility):
    """Gets all data shared by power, storage, and extraction facilities"""
    engine: GameEngine = current_app.config["engine"]
    const_config_assets = engine.const_config["assets"]
    return {
        "construction_pollution": const_config_assets[facility]["base_construction_pollution"],
        "operating_costs": const_config_assets[facility]["base_price"]
        * price_multiplier(player, facility)
        * (
            hydro_price_multiplier(player, facility)
            if facility in ["watermill", "small_water_dam", "large_water_dam"]
            else 1.0
        )
        * const_config_assets[facility]["O&M_factor_per_day"]
        / 24,
        "lifespan": const_config_assets[facility]["lifespan"] / engine.in_game_seconds_per_tick,
    }


def package_power_facilities(player: Player):
    """Gets all data relevant for the power_facilities frontend"""
    # TODO: add wind and hydro potential
    engine: GameEngine = current_app.config["engine"]
    const_config_assets = engine.const_config["assets"]
    return [
        _package_facility_base(player, power_facility)
        | _package_power_generating_facility_base(player, power_facility)
        | _package_power_storage_extraction_facility_base(player, power_facility)
        | {
            "consumed_resources": power_facility_resource_consumption(player, power_facility),
        }
        | (
            {
                "pollution": const_config_assets[power_facility]["base_pollution"]
                / efficiency_multiplier(player, power_facility)
            }
            if power_facility in engine.controllable_facilities + engine.storage_facilities
            else {}
        )
        for power_facility in engine.power_facilities
    ]


def package_storage_facilities(player: Player):
    """Gets all data relevant for the storage_facilities frontend"""
    engine: GameEngine = current_app.config["engine"]
    const_config_assets = engine.const_config["assets"]
    return [
        _package_facility_base(player, storage_facility)
        | _package_power_generating_facility_base(player, storage_facility)
        | _package_power_storage_extraction_facility_base(player, storage_facility)
        | {
            "storage_capacity": const_config_assets[storage_facility]["base_storage_capacity"]
            * capacity_multiplier(player, storage_facility),
            "efficiency": const_config_assets[storage_facility]["base_efficiency"]
            * efficiency_multiplier(player, storage_facility)
            * 100,
        }
        for storage_facility in engine.storage_facilities
    ]


def package_extraction_facilities(player: Player):
    """Gets all data relevant for the extraction_facilities frontend"""
    engine: GameEngine = current_app.config["engine"]
    const_config_assets = engine.const_config["assets"]
    facility_to_resource = {
        "coal_mine": "coal",
        "gas_drilling_site": "gas",
        "uranium_mine": "uranium",
    }

    # TODO: remove this, let the frontend compute it (since tile resource can change often)
    def tile_resource_amount(tile: Hex, resource: str):
        if resource == "coal":
            return tile.coal
        elif resource == "gas":
            return tile.gas
        elif resource == "uranium":
            return tile.uranium
        else:
            raise ValueError(f"unknown resource {resource}")

    return [
        _package_facility_base(player, extraction_facility)
        | _package_power_storage_extraction_facility_base(player, extraction_facility)
        | {
            "power_consumption": const_config_assets[extraction_facility]["base_power_consumption"]
            * power_consumption_multiplier(player, extraction_facility),
            "pollution": const_config_assets[extraction_facility]["base_pollution"]
            * 1000
            * extraction_emissions_multiplier(player, extraction_facility),
            "resource_production": {
                "name": facility_to_resource[extraction_facility],
                "rate": const_config_assets[extraction_facility]["base_extraction_rate_per_day"]
                * extraction_rate_multiplier(player)
                * tile_resource_amount(player.tile, facility_to_resource[extraction_facility])
                / 24,
            },
        }
        for extraction_facility in engine.extraction_facilities
    ]


def player_can_launch_project(player: Player, facility):
    """Returns true if facility is not hidden and if requirements are met"""
    return not facility_is_hidden(player, facility) and requirements_met(facility_requirements(player, facility))


def facility_is_hidden(player: Player, facility):
    """
    Returns true if the facility is hidden to the player due to lack of achievements.
    Such facilities should not be shown on the frontend.
    """
    if "Discover the Greenhouse Effect" not in player.achievements and facility == "carbon_capture":
        return True
    return False


def next_level(player: Player, facility_or_technology: str) -> int:
    """Returns the level of the next `facility_or_technology` upgrade, e.g. current level + # ongoing upgrades + one"""
    return (
        getattr(player, facility_or_technology)
        + OngoingConstruction.query.filter(
            OngoingConstruction.player_id == player.id,
            OngoingConstruction.name == facility_or_technology,
        ).count()
        + 1
    )


def package_change(current, upgraded):
    """
    `current` can be `None` to represent a new ability rather than an upgrade.
    If both values are the same, e.g. lab workers, there is no change, so returns None.
    """
    if current == upgraded:
        return None
    else:
        return {"current": current, "upgraded": upgraded}


def package_functional_facilities(player: Player):
    """Gets all data relevant for the functional_facilities frontend"""
    engine: GameEngine = current_app.config["engine"]
    const_config_assets = engine.const_config["assets"]

    def industry_average_consumption_for_level(level):
        return (
            const_config_assets["industry"]["base_power_consumption"]
            * const_config_assets["industry"]["power_factor"] ** level
        )

    def industry_hourly_revenues_for_level(level):
        return (
            const_config_assets["industry"]["base_income_per_day"]
            * const_config_assets["industry"]["income_factor"] ** level
            + const_config_assets["industry"]["universal_income_per_day"]
        ) / 24

    def carbon_capture_power_consumption_for_level(level):
        if level == 0:
            return 0
        else:
            return (
                const_config_assets["carbon_capture"]["base_power_consumption"]
                * const_config_assets["carbon_capture"]["power_factor"] ** level
            )

    def carbon_capture_absorption(level):
        if level == 0:
            return 0
        else:
            return (
                const_config_assets["carbon_capture"]["base_absorption_per_day"]
                * const_config_assets["carbon_capture"]["absorption_factor"] ** level
                * engine.data["current_climate_data"].get_co2()  # TODO: make this part be a client side computation
                / 24
            )

    next_industry_level = next_level(player, "industry")
    next_laboratory_level = next_level(player, "laboratory")
    next_warehouse_level = next_level(player, "warehouse")
    next_carbon_capture_level = next_level(player, "carbon_capture")

    special_keys = {
        "industry": {
            "level": next_industry_level,
            "average_consumption": package_change(
                current=industry_average_consumption_for_level(next_industry_level - 1),
                upgraded=industry_average_consumption_for_level(next_industry_level),
            ),
            "revenue_generation": package_change(
                current=industry_hourly_revenues_for_level(next_industry_level - 1),
                upgraded=industry_hourly_revenues_for_level(next_industry_level),
            ),
        },
        "laboratory": {
            "level": next_laboratory_level,
            "lab_workers": package_change(
                current=player_lab_workers_for_level(next_laboratory_level - 1),
                upgraded=player_lab_workers_for_level(next_laboratory_level),
            ),
        }
        | (
            {
                "research_speed_bonus": 100 - const_config_assets["laboratory"]["time_factor"] * 100,
            }
            if next_laboratory_level > 1  # Don't show for research_speed_bonus 0 -> 1, only for 1 -> 2 onwards
            else {}
        ),
        "warehouse": {
            "level": next_warehouse_level,
            "warehouse_capacities": {
                resource: package_change(
                    current=warehouse_capacity_for_level(next_warehouse_level - 1, resource),
                    upgraded=warehouse_capacity_for_level(next_warehouse_level, resource),
                )
                for resource in engine.extractable_resources
            },
        },
        "carbon_capture": {
            "level": next_carbon_capture_level,
            "power_consumption": package_change(
                current=carbon_capture_power_consumption_for_level(next_carbon_capture_level - 1),
                upgraded=carbon_capture_power_consumption_for_level(next_carbon_capture_level),
            ),
            "co2_absorption": package_change(
                current=carbon_capture_absorption(next_carbon_capture_level - 1),
                upgraded=carbon_capture_absorption(next_carbon_capture_level),
            ),
        },
    }
    result = [
        _package_facility_base(player, functional_facility)
        | {
            "construction_pollution": const_config_assets[functional_facility]["base_construction_pollution"]
            * const_config_assets[functional_facility]["price_multiplier"] ** getattr(player, functional_facility),
        }
        | special_keys[functional_facility]
        for functional_facility in engine.functional_facilities
    ]
    return list(filter(lambda facility_data: not facility_is_hidden(player, facility_data["name"]), result))


def package_constructions_page_data(player: Player):
    """
    Gets cost, emissions, max power, etc data for constructions.
    Takes into account base config prices and multipliers for the specified player.
    Returns a dictionary with the relevant data for constructions.
    Example:
        {
            'power_facilities': {
                'steam_engine': {
                    'price': 123.4
                    ...
                }
                ...
            }
        }
    ```
    """
    return {
        "power_facilities": package_power_facilities(player),
        "storage_facilities": package_storage_facilities(player),
        "extraction_facilities": package_extraction_facilities(player),
        "functional_facilities": package_functional_facilities(player),
    }


def package_available_technologies(player: Player):
    engine: GameEngine = current_app.config["engine"]
    const_config_assets = engine.const_config["assets"]
    # TODO: This `technologies` list should be stored somewhere else, e.g. in config
    technologies: List[str] = [
        "mathematics",
        "mechanical_engineering",
        "thermodynamics",
        "physics",
        "building_technology",
        "mineral_extraction",
        "transport_technology",
        "materials",
        "civil_engineering",
        "aerodynamics",
        "chemistry",
        "nuclear_engineering",
    ]
    levels: Dict[str, int] = {technology: next_level(player, technology) for technology in technologies}
    return {
        technology: _package_facility_base(player, technology)
        | {
            "level": levels[technology],
            "affected_facilities": [
                const_config_assets[facility]["name"]
                for facility in const_config_assets[technology]["affected_facilities"]
            ],
        }
        | (
            {
                "power_generation_bonus": const_config_assets[technology]["prod_factor"] * 100 - 100,
                "price_penalty": (const_config_assets[technology]["price_factor"] * 100 - 100),
            }
            if technology == "mechanical_engineering"
            else {}
        )
        | (
            {
                "fuel_use_reduction_bonus": (const_config_assets[technology]["efficiency_factor"] - 1)
                / const_config_assets[technology]["efficiency_factor"]
                * 100,
                "co2_emissions_reduction_bonus": (const_config_assets[technology]["efficiency_factor"] - 1)
                / const_config_assets[technology]["efficiency_factor"]
                * 100,
                "molten_salt_efficiency_bonus": (
                    (1 - 1 / const_config_assets[technology]["efficiency_factor"])
                    * (
                        1
                        - engine.const_config["assets"]["molten_salt"]["base_efficiency"]
                        * efficiency_multiplier_thermodynamics(player, "molten_salt", level=levels[technology] - 1)
                    )
                    * 100
                ),
            }
            if technology == "thermodynamics"
            else {}
        )
        | (
            {
                "price_penalty": (const_config_assets[technology]["price_factor"] * 100 - 100),
                "power_generation_bonus": const_config_assets[technology]["prod_factor"] * 100 - 100,
            }
            if technology == "physics"
            else {}
        )
        | (
            {
                "construction_time_reduction_bonus": (100 - const_config_assets[technology]["time_factor"] * 100),
                "construction_workers": package_change(
                    player_construction_workers_for_level(levels[technology] - 1),
                    player_construction_workers_for_level(levels[technology]),
                ),
            }
            if technology == "building_technology"
            else {}
        )
        | (
            {
                "extraction_speed_bonus": 100
                * extraction_rate_multiplier(player, levels[technology])
                / extraction_rate_multiplier(player, levels[technology] - 1)
                - 100,
                "power_consumption_penalty": 100
                * const_config_assets[technology]["energy_factor"]
                / (1 + const_config_assets[technology]["energy_factor"] * (levels[technology] - 1)),
                "co2_emissions_penalty": 100
                * const_config_assets[technology]["pollution_factor"]
                / (1 + const_config_assets[technology]["pollution_factor"] * (levels[technology] - 1)),
                "price_penalty": (const_config_assets[technology]["price_factor"] * 100 - 100),
            }
            if technology == "mineral_extraction"
            else {}
        )
        | (
            {
                "shipment_time_reduction_bonus": 100 - const_config_assets[technology]["time_factor"] * 100,
                "power_consumption_reduction_bonus": (
                    const_config_assets[technology]["energy_factor"] / const_config_assets[technology]["time_factor"]
                    - 1
                )
                * 100,
            }
            if technology == "transport_technology"
            else {}
        )
        | (
            {
                "price_reduction_bonus": (const_config_assets[technology]["price_factor"] * 100 - 100),
                "construction_power_reduction_bonus": 100
                - const_config_assets[technology]["construction_energy_factor"] * 100,
            }
            if technology == "materials"
            else {}
        )
        | (
            {
                "storage_capacity_bonus": const_config_assets[technology]["capacity_factor"] * 100 - 100,
                "power_generation_bonus": const_config_assets[technology]["prod_factor"] * 100 - 100,
                "price_penalty": (const_config_assets[technology]["price_factor"] * 100 - 100),
            }
            if technology == "civil_engineering"
            else {}
        )
        | (
            {
                "power_generation_bonus": const_config_assets[technology]["prod_factor"] * 100 - 100,
                "price_penalty": (const_config_assets[technology]["price_factor"] * 100 - 100),
            }
            if technology == "aerodynamics"
            else {}
        )
        | (
            {
                "hydrogen_efficiency_bonus": (1 - const_config_assets[technology]["inefficiency_factor"])
                * (
                    0.65
                    - engine.const_config["assets"]["hydrogen_storage"]["base_efficiency"]
                    * efficiency_multiplier_chemistry(player, "hydrogen_storage", level=levels[technology] - 1)
                )
                * 100,
                "lithium_ion_efficiency_bonus": (1 - const_config_assets[technology]["inefficiency_factor"])
                * (
                    1
                    - engine.const_config["assets"]["lithium_ion_batteries"]["base_efficiency"]
                    * efficiency_multiplier_chemistry(player, "lithium_ion_batteries", level=levels[technology] - 1)
                )
                * 100,
                "solid_state_efficiency_bonus": (1 - const_config_assets[technology]["inefficiency_factor"])
                * (
                    1
                    - engine.const_config["assets"]["solid_state_batteries"]["base_efficiency"]
                    * efficiency_multiplier_chemistry(player, "solid_state_batteries", level=levels[technology] - 1)
                )
                * 100,
                "price_penalty": (const_config_assets[technology]["price_factor"] * 100 - 100),
            }
            if technology == "chemistry"
            else {}
        )
        | (
            {
                "power_generation_bonus": const_config_assets[technology]["prod_factor"] * 100 - 100,
                "price_penalty": (const_config_assets[technology]["price_factor"] * 100 - 100),
            }
            if technology == "nuclear_engineering"
            else {}
        )
        # price_reduction_bonus
        for technology in technologies
    }
