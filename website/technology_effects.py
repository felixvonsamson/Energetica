"""
This files contains all the functions to calculate the different parameters of
facilities according to the technology levels of the player.
"""

import math
from flask import current_app

from website import gameEngine
from website.database.map import Hex
from website.database.player import Player
from .database.player_assets import Active_facilities, Under_construction


def price_multiplier(player, facility):
    """Function that returns the price multiplier according to the technology level of the player."""
    const_config = current_app.config["engine"].const_config["assets"]
    mlt = 1
    # Mechanical engineering
    if facility in const_config["mechanical_engineering"]["affected facilities"]:
        mlt *= const_config["mechanical_engineering"]["price factor"] ** player.mechanical_engineering
    # Physics
    if facility in const_config["physics"]["affected facilities"]:
        mlt *= const_config["physics"]["price factor"] ** player.physics
    # Mineral extraction
    if facility in const_config["mineral_extraction"]["affected facilities"]:
        mlt *= const_config["mineral_extraction"]["price factor"] ** player.mineral_extraction
    # Materials
    if facility in const_config["materials"]["affected facilities"]:
        mlt *= const_config["materials"]["price factor"] ** player.materials
    # Civil engineering
    if facility in const_config["civil_engineering"]["affected facilities"]:
        mlt *= const_config["civil_engineering"]["price factor"] ** player.civil_engineering
    # Aerodynamics
    if facility in const_config["aerodynamics"]["affected facilities"]:
        mlt *= const_config["aerodynamics"]["price factor"] ** player.aerodynamics
    # Chemistry
    if facility in const_config["chemistry"]["affected facilities"]:
        mlt *= const_config["chemistry"]["price factor"] ** player.chemistry
    # Nuclear engineering
    if facility in const_config["nuclear_engineering"]["affected facilities"]:
        mlt *= const_config["nuclear_engineering"]["price factor"] ** player.nuclear_engineering
    # level based facilities and technologies
    engine = current_app.config["engine"]
    if facility in engine.functional_facilities + engine.technologies:
        mlt *= const_config[facility]["price multiplier"] ** getattr(player, facility)
    # knowledge spilling for technologies
    if facility in engine.technologies:
        mlt *= 0.92 ** engine.data["technology_lvls"][facility][getattr(player, facility)]
    return mlt


def power_multiplier(player, facility):
    """Function that returns the power multiplier according to the technology level of the player."""
    const_config = current_app.config["engine"].const_config["assets"]
    mlt = 1
    # Mechanical engineering
    if facility in const_config["mechanical_engineering"]["affected facilities"]:
        mlt *= const_config["mechanical_engineering"]["prod factor"] ** player.mechanical_engineering
    # Physics
    if facility in const_config["physics"]["affected facilities"]:
        mlt *= const_config["physics"]["prod factor"] ** player.physics
    # Mineral extraction (in this case it is the energy consumption)
    if facility in const_config["mineral_extraction"]["affected facilities"]:
        mlt *= const_config["mineral_extraction"]["energy factor"] ** player.mineral_extraction
    # Civil engineering
    if facility in const_config["civil_engineering"]["affected facilities"]:
        mlt *= const_config["civil_engineering"]["prod factor"] ** player.civil_engineering
    # Aerodynamics
    if facility in const_config["aerodynamics"]["affected facilities"]:
        mlt *= const_config["aerodynamics"]["prod factor"] ** player.aerodynamics
    # Nuclear engineering
    if facility in const_config["nuclear_engineering"]["affected facilities"]:
        mlt *= const_config["nuclear_engineering"]["prod factor"] ** player.nuclear_engineering
    return mlt


def capacity_multiplier(player, facility):
    """Function that returns the capacity multiplier according to the technology level of the player."""
    const_config = current_app.config["engine"].const_config["assets"]
    mlt = 1
    # Mineral extraction (in this case it is the extraction rate in fraction of total underground stock per minute)
    if facility in const_config["mineral_extraction"]["affected facilities"]:
        mlt *= const_config["mineral_extraction"]["extract factor"] ** player.mineral_extraction
    # Civil engineering
    if facility in ["small_pumped_hydro", "large_pumped_hydro"]:
        mlt *= const_config["civil_engineering"]["capacity factor"] ** player.civil_engineering
    # calculating the hydro price multiplier linked to the number of hydro facilities
    if facility in ["watermill", "small_water_dam", "large_water_dam"]:
        mlt *= hydro_price_function(efficiency_multiplier(player, facility), player.tile.hydro)
    # calculating the wind speed multiplier linked to the number of wind turbines
    if facility in ["windmill", "onshore_wind_turbine", "offshore_wind_turbine"]:
        mlt *= wind_speed_multiplier(efficiency_multiplier(player, facility), player.tile.wind)
    return mlt


def efficiency_multiplier(player, facility):
    """Function that returns the efficiency multiplier according to the technology level of the player."""
    const_config = current_app.config["engine"].const_config["assets"]
    mlt = 1
    # Thermodynamics
    if facility in const_config["thermodynamics"]["affected facilities"]:
        thermodynamic_factor = const_config["thermodynamics"]["efficiency_factor"] ** player.thermodynamics
        if facility == "compressed_air":
            return (
                0.8 / const_config[facility]["initial_efficiency"] * (1 - 1 / thermodynamic_factor)
                + 1 / thermodynamic_factor
            )
        if facility == "molten_salt":
            return (
                1 / const_config[facility]["initial_efficiency"] * (1 - 1 / thermodynamic_factor)
                + 1 / thermodynamic_factor
            )
        mlt *= thermodynamic_factor
    # Mineral extraction (in this case the the multiplicator is for emissions)
    if facility in const_config["mineral_extraction"]["affected facilities"]:
        mlt *= const_config["mineral_extraction"]["pollution factor"] ** player.mineral_extraction
    # Chemistry
    if facility in const_config["chemistry"]["affected facilities"]:
        chemistry_factor = const_config["chemistry"]["inefficiency_factor"] ** player.chemistry
        if facility == "hydrogen_storage":
            return 0.65 / const_config[facility]["initial_efficiency"] * (1 - chemistry_factor) + chemistry_factor
        return 1 / const_config[facility]["initial_efficiency"] * (1 - chemistry_factor) + chemistry_factor
    # finding the next available location for a hydro and wind facilities
    if facility in [
        "watermill",
        "small_water_dam",
        "large_water_dam",
        "windmill",
        "onshore_wind_turbine",
        "offshore_wind_turbine",
    ]:
        active_facilities = Active_facilities.query.filter_by(facility=facility, player_id=player.id).all()
        under_construction = Under_construction.query.filter_by(name=facility, player_id=player.id).all()
        # Create a set of used efficiency multipliers
        used_locations = {af.efficiency_multiplier for af in active_facilities}
        used_locations.update(uc.efficiency_multiplier for uc in under_construction)
        i = 0
        while i in used_locations:
            i += 1
        return i
    return mlt


def construction_time(player, facility):
    """Function that returns the construction time according to the technology level of the player."""
    engine = current_app.config["engine"]
    const_config = engine.const_config["assets"]
    # dilatation foactor dependent on clock_time
    duration = const_config[facility]["base_construction_time"] * (engine.clock_time / 60) ** 0.5
    # construction time increases with higher levels
    if facility in engine.functional_facilities + engine.technologies:
        duration *= const_config[facility]["price multiplier"] ** (0.6 * getattr(player, facility))
    # knowledge spillover and laboratory time reduction
    if facility in engine.technologies:
        duration *= 0.92 ** engine.data["technology_lvls"][facility][getattr(player, facility)]
        duration *= const_config["laboratory"]["time factor"] ** player.laboratory
    # building technology time reduction
    if (
        facility
        in engine.storage_facilities
        + engine.controllable_facilities
        + engine.renewables
        + engine.extraction_facilities
        + engine.functional_facilities
    ):
        duration *= const_config["building_technology"]["time factor"] ** player.building_technology
    return math.ceil(duration / engine.clock_time) * engine.clock_time


def construction_power(player, facility):
    """Function that returns the construction power according to the technology level of the player."""
    engine = current_app.config["engine"]
    const_config = engine.const_config["assets"]
    bt_factor = const_config["building_technology"]["time factor"] ** player.building_technology
    # construction power in relation of facilities characteristics
    if facility in engine.power_facilities:
        # Materials (in this case it is the energy consumption for construction)
        mlt = 1
        if facility in const_config["materials"]["affected facilities"]:
            mlt *= const_config["materials"]["construction energy factor"] ** player.materials
        return (
            const_config[facility]["base_power_generation"]
            * const_config[facility]["construction_power_factor"]
            * power_multiplier(player, facility)
            * mlt
            / bt_factor
        )
    if facility in engine.extraction_facilities:
        return (
            const_config[facility]["base_power_consumption"]
            * const_config[facility]["construction_power_factor"]
            * capacity_multiplier(player, facility)
            / bt_factor
        )
    if facility in engine.storage_facilities:
        return (
            const_config[facility]["base_storage_capacity"]
            * const_config[facility]["construction_power_factor"]
            * capacity_multiplier(player, facility)
            / bt_factor
        )
    power = const_config[facility]["base_construction_energy"] / construction_time(player, facility) * 3600
    # construction power increases with higher levels
    if facility in engine.functional_facilities + engine.technologies:
        power *= const_config[facility]["price multiplier"] ** (1.2 * getattr(player, facility))
    # knowledge spillover
    if facility in engine.technologies:
        power *= 0.92 ** engine.data["technology_lvls"][facility][getattr(player, facility)]
    return power


def construction_pollution_per_tick(player, facility):
    """Function that returns the construction pollution per tick according to the technology level of the player."""
    engine = current_app.config["engine"]
    const_config = engine.const_config["assets"]
    if facility in engine.technologies:
        return 0
    pollution = (
        const_config[facility]["base_construction_pollution"] / construction_time(player, facility) * engine.clock_time
    )
    # construction pollution increases with higher levels for functional facilities
    if facility in engine.functional_facilities:
        pollution *= const_config[facility]["price multiplier"] ** getattr(player, facility)
    return pollution


def time_multiplier():
    """dilatation foactor dependent on clock_time"""
    return (current_app.config["engine"].clock_time / 60) ** 0.5


def hydro_price_function(count, potential):
    """price multiplier coefficient, for the `count`th hydro facility of a particular type, given the hydro potential"""
    return 0.6 + (math.e ** (0.6 * (count + 1 - 3 * potential) / (0.3 + potential)))


def wind_speed_multiplier(count, potential):
    """wind speed multiplier, for the `count`th wind facility of a particular type, given the wind potential"""
    return 1 / (math.log(math.e + (count * (1 / (9 * potential + 1))) ** 2))


def facility_requirements(player, facility):
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


def facility_requirements_and_locked(player, facility):
    """Returns a dictionnary with both requirements and locked status"""
    requirements = facility_requirements(player, facility)
    locked = requirements_met(requirements)
    return {"requirements": requirements, "locked": locked}


def power_facility_resource_consumption(player, power_facility):
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


def get_current_technology_values(player):
    """Function that returns the facility values for the current technology of the player."""
    engine = current_app.config["engine"]
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
        dict[facility]["power_multiplier"] = power_multiplier(player, facility)
    for facility in engine.controllable_facilities + engine.storage_facilities:
        dict[facility]["efficiency_multiplier"] = efficiency_multiplier(player, facility)
    for facility in ["watermill", "small_water_dam", "large_water_dam"]:
        dict[facility]["special_price_multiplier"] = capacity_multiplier(player, facility)
    for facility in engine.storage_facilities:
        dict[facility]["capacity_multiplier"] = capacity_multiplier(player, facility)
    for facility in engine.extraction_facilities:
        dict[facility]["extraction_multiplier"] = capacity_multiplier(player, facility)
        dict[facility]["power_use_multiplier"] = power_multiplier(player, facility)
        dict[facility]["pollution_multiplier"] = efficiency_multiplier(player, facility)
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
    engine: gameEngine = current_app.config["engine"]
    const_config_assets = engine.const_config["assets"]
    return {
        "name": facility,
        "display_name": const_config_assets[facility]["name"],
        "description": const_config_assets[facility]["description"],
        "wikipedia_link": const_config_assets[facility]["wikipedia_link"],
        "price": const_config_assets[facility]["base_price"]
        * price_multiplier(player, facility)
        * (
            capacity_multiplier(player, facility)
            if facility in ["watermill", "small_water_dam", "large_water_dam"]
            else 1.0
        ),
        "construction_power": construction_power(player, facility),
        "construction_time": construction_time(player, facility),
        "locked": requirements_met(facility_requirements(player, facility)),
        "requirements": facility_requirements(player, facility),
    }


def _package_power_generating_facility_base(player: Player, facility):
    """Gets all data shared by power and storage facilites"""
    engine: gameEngine = current_app.config["engine"]
    const_config_assets = engine.const_config["assets"]
    return {
        "power_generation": const_config_assets[facility]["base_power_generation"] * power_multiplier(player, facility),
        "ramping_time": const_config_assets[facility]["ramping_time"] / power_multiplier(player, facility)
        if const_config_assets[facility]["ramping_time"] != 0
        else None,
        "ramping_speed": const_config_assets[facility]["base_power_generation"]
        * power_multiplier(player, facility)
        / const_config_assets[facility]["ramping_time"]
        if const_config_assets[facility]["ramping_time"] != 0
        else None,
    }


def _package_power_storage_extraction_facility_base(player: Player, facility):
    """Gets all data shared by power, storage, and extraction facilites"""
    engine: gameEngine = current_app.config["engine"]
    const_config_assets = engine.const_config["assets"]
    return {
        "construction_pollution": const_config_assets[facility]["base_construction_pollution"],
        "operating_costs": const_config_assets[facility]["base_price"]
        * price_multiplier(player, facility)
        * const_config_assets[facility]["O&M_factor"]
        * 3600
        / engine.clock_time,
        "lifespan": const_config_assets[facility]["lifespan"] * (engine.clock_time / 60) ** 0.5,
    }


def package_power_facilities(player: Player):
    """Gets all data relevant for the power_facilities frontend"""
    engine: gameEngine = current_app.config["engine"]
    const_config_assets = engine.const_config["assets"]
    return [
        _package_facility_base(player, power_facility)
        | _package_power_generating_facility_base(player, power_facility)
        | _package_power_storage_extraction_facility_base(player, power_facility)
        | {
            "pollution": const_config_assets[power_facility]["base_pollution"]
            / efficiency_multiplier(player, power_facility)
            if power_facility in engine.controllable_facilities + engine.storage_facilities
            else 1,
            "consumed_resources": power_facility_resource_consumption(player, power_facility),
        }
        for power_facility in engine.power_facilities
    ]


def package_storage_facilities(player: Player):
    """Gets all data relevant for the storage_facilities frontend"""
    engine: gameEngine = current_app.config["engine"]
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
    engine: gameEngine = current_app.config["engine"]
    const_config_assets = engine.const_config["assets"]
    facility_to_resource = {
        "coal_mine": "coal",
        "oil_field": "oil",
        "gas_drilling_site": "gas",
        "uranium_mine": "uranium",
    }

    def tile_resource_amount(tile: Hex, resource: str):
        if resource == "coal":
            return tile.coal
        elif resource == "oil":
            return tile.oil
        elif resource == "gas":
            return tile.gas
        elif resource == "uranium":
            return tile.uranium
        else:
            raise ValueError(f"unkown resource {resource}")

    return [
        _package_facility_base(player, extraction_facility)
        | _package_power_storage_extraction_facility_base(player, extraction_facility)
        | {
            "power_consumption": const_config_assets[extraction_facility]["base_power_consumption"]
            * power_multiplier(player, extraction_facility),
            "pollution": const_config_assets[extraction_facility]["base_pollution"]
            * 1000
            * efficiency_multiplier(player, extraction_facility),
            "resource_production": {
                "name": facility_to_resource[extraction_facility],
                "rate": const_config_assets[extraction_facility]["extraction_rate"]
                * capacity_multiplier(player, extraction_facility)
                * tile_resource_amount(player.tile, facility_to_resource[extraction_facility])
                / engine.clock_time
                * 3600,
            },
        }
        for extraction_facility in engine.extraction_facilities
    ]


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
        # TODO: non-power facilities
        "functional_facilities": [],
    }
