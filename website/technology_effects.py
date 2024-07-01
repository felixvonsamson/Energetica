"""
This files contains all the functions to calculate the different parameters of
facilities according to the technology levels of the player.
"""

import math
from flask import current_app

from website import gameEngine
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


def construction_pollution(player, facility):
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
    # dilatation foactor dependent on clock_time
    return (current_app.config["engine"].clock_time / 60) ** 0.5


def hydro_price_function(count, potential):
    return 0.6 + (math.e ** (0.6 * (count + 1 - 3 * potential) / (0.3 + potential)))


def wind_speed_multiplier(count, potential):
    return 1 / (math.log(math.e + (count * (1 / (9 * potential + 1))) ** 2))


def facility_requirements(player, facility):
    """Returns the list of requirements (name, level, and boolean for met) for the specified facility"""
    requirements = current_app.config["engine"].const_config["assets"][facility]["requirements"].copy()
    for requirement in requirements:
        requirement[2] = getattr(player, requirement[0]) >= requirement[1]
    return requirements


def requirements_met(requirements):
    """Returns True (meaning locked) if any requirements are not met, otherwise False (not locked)"""
    return any(req[2] is False for req in requirements)


def facility_requirements_and_locked(player, facility):
    "Returns a dictionnary with both"
    requirements = facility_requirements(player, facility)
    locked = requirements_met(requirements)
    return {"requirements": requirements, "locked": locked}


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
            "construction_pollution": construction_pollution(player, facility),
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
        # add "requirements" and "locked" to the dictionnary
        dict[facility] |= facility_requirements_and_locked(player, facility)

    return dict


def package_constructions_page_data(player):
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
    engine: gameEngine = current_app.config["engine"]
    const_config_assets = engine.const_config["assets"]
    # power_facilities_property_keys = [
    #     "price",
    #     "construction time",
    #     "construction power",
    #     "construction pollution",
    #     "locked",
    #     "power generation",
    #     "ramping speed",
    #     "O&M cost",
    #     "consumed resource",
    #     "pollution",
    #     "lifespan",
    # ]
    return {
        "power_facilities": [
            {
                "name": power_facility,
                "price": const_config_assets[power_facility]["base_price"]
                * price_multiplier(player, power_facility)
                * (
                    capacity_multiplier(player, power_facility)
                    if power_facility in ["watermill", "small_water_dam", "large_water_dam"]
                    else 1.0
                ),
                "construction_time": construction_time(player, power_facility),
                "construction_power": construction_power(player, power_facility),
                "construction_pollution": construction_pollution(player, power_facility),
                "locked": requirements_met(facility_requirements(player, power_facility)),
                # TODO: all values below
                "power_generation": 0,
                "ramping_speed": 0,
                "O&M_costs": 0,
                "consumed_resource": {},
                "pollution": 0,
                "lifespan": 0,
            }
            for power_facility in engine.power_facilities
        ],
        # TODO: non-power facilities
        "storage_facilities": [],
        "extraction_facilities": [],
        "functional_facilities": [],
    }
