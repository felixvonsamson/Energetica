# This files contains all the functions to calculate the different parameters of facilities according to the technology levels of the player.

from .config import const_config
from .utils import hydro_price_function
from flask import current_app


def price_multiplier(player, facility):
    """Function that returns the price multiplier according to the technology level of the player."""
    mlt = 1
    # Mechanical engineering
    if facility in const_config["assets"]["mechanical_engineering"]["affected facilities"]:
        mlt *= const_config["assets"]["mechanical_engineering"]["price factor"] ** player.mechanical_engineering
    # Physics
    if facility in const_config["assets"]["physics"]["affected facilities"]:
        mlt *= const_config["assets"]["physics"]["price factor"] ** player.physics
    # Mineral extraction
    if facility in const_config["assets"]["mineral_extraction"]["affected facilities"]:
        mlt *= const_config["assets"]["mineral_extraction"]["price factor"] ** player.mineral_extraction
    # Materials
    if facility in const_config["assets"]["materials"]["affected facilities"]:
        mlt *= const_config["assets"]["materials"]["price factor"] ** player.materials
    # Civil engineering
    if facility in const_config["assets"]["civil_engineering"]["affected facilities"]:
        if facility in ["watermill", "small_water_dam", "large_water_dam"]:
            mlt *= hydro_price_function(getattr(player, facility), player.tile.hydro)
        mlt *= const_config["assets"]["civil_engineering"]["price factor"] ** player.civil_engineering
    # Aerodynamics
    if facility in const_config["assets"]["aerodynamics"]["affected facilities"]:
        mlt *= const_config["assets"]["aerodynamics"]["price factor"] ** player.aerodynamics
    # Chemistry
    if facility in const_config["assets"]["chemistry"]["affected facilities"]:
        mlt *= const_config["assets"]["chemistry"]["price factor"] ** player.chemistry
    # Nuclear engineering
    if facility in const_config["assets"]["nuclear_engineering"]["affected facilities"]:
        mlt *= const_config["assets"]["nuclear_engineering"]["price factor"] ** player.nuclear_engineering
    # level based facilities and technologies
    engine = current_app.config["engine"]
    if facility in engine.functional_facilities + engine.technologies:
        mlt *= const_config["assets"][facility]["price multiplier"] ** getattr(player, facility)
    # knowledge spilling for technologies
    if facility in engine.technologies:
        mlt *= 0.92 ** engine.data["technology_lvls"][facility][getattr(player, facility)]
    return mlt


def power_multiplier(player, facility):
    """Function that returns the power multiplier according to the technology level of the player."""
    mlt = 1
    # Mechanical engineering
    if facility in const_config["assets"]["mechanical_engineering"]["affected facilities"]:
        mlt *= const_config["assets"]["mechanical_engineering"]["prod factor"] ** player.mechanical_engineering
    # Physics
    if facility in const_config["assets"]["physics"]["affected facilities"]:
        mlt *= const_config["assets"]["physics"]["prod factor"] ** player.physics
    # Mineral extraction (in this case it is the energy consumption)
    if facility in const_config["assets"]["mineral_extraction"]["affected facilities"]:
        mlt *= const_config["assets"]["mineral_extraction"]["energy factor"] ** player.mineral_extraction
    # Materials (in this case it is the energy consumption for construction)
    if facility in const_config["assets"]["materials"]["affected facilities"]:
        mlt *= const_config["assets"]["materials"]["construction energy factor"] ** player.materials
    # Civil engineering
    if facility in const_config["assets"]["civil_engineering"]["affected facilities"]:
        mlt *= const_config["assets"]["civil_engineering"]["prod factor"] ** player.civil_engineering
    # Aerodynamics
    if facility in const_config["assets"]["aerodynamics"]["affected facilities"]:
        mlt *= const_config["assets"]["aerodynamics"]["prod factor"] ** player.aerodynamics
    # Nuclear engineering
    if facility in const_config["assets"]["nuclear_engineering"]["affected facilities"]:
        mlt *= const_config["assets"]["nuclear_engineering"]["prod factor"] ** player.nuclear_engineering
    return mlt


def capacity_multiplier(player, facility):
    """Function that returns the capacity multiplier according to the technology level of the player."""
    mlt = 1
    # Mineral extraction (in this case it is the extraction rate in fraction of total underground stock per minute)
    if facility in const_config["assets"]["mineral_extraction"]["affected facilities"]:
        mlt *= const_config["assets"]["mineral_extraction"]["extract factor"] ** player.mineral_extraction
    # Civil engineering
    if facility in ["small_pumped_hydro", "large_pumped_hydro"]:
        mlt *= const_config["assets"]["civil_engineering"]["capacity factor"] ** player.civil_engineering
    return mlt


def efficiency_multiplier(player, facility):
    """Function that returns the efficiency multiplier according to the technology level of the player."""
    mlt = 1
    # Thermodynamics
    if facility in const_config["assets"]["thermodynamics"]["affected facilities"]:
        thermodynamic_factor = const_config["assets"]["thermodynamics"]["efficiency_factor"] ** player.thermodynamics
        if facility == "compressed_air":
            return (
                0.8 / const_config["assets"][facility]["initial_efficiency"] * (1 - 1 / thermodynamic_factor)
                + 1 / thermodynamic_factor
            )
        if facility == "molten_salt":
            return (
                1 / const_config["assets"][facility]["initial_efficiency"] * (1 - 1 / thermodynamic_factor)
                + 1 / thermodynamic_factor
            )
        mlt *= thermodynamic_factor
    # Mineral extraction (in this case the the multiplicator is for emissions)
    if facility in const_config["assets"]["mineral_extraction"]["affected facilities"]:
        mlt *= const_config["assets"]["mineral_extraction"]["pollution factor"] ** player.mineral_extraction
    # Chemistry
    if facility in const_config["assets"]["chemistry"]["affected facilities"]:
        chemistry_factor = const_config["assets"]["chemistry"]["inefficiency_factor"] ** player.chemistry
        if facility == "hydrogen_storage":
            return (
                0.65 / const_config["assets"][facility]["initial_efficiency"] * (1 - chemistry_factor)
                + chemistry_factor
            )
        return 1 / const_config["assets"][facility]["initial_efficiency"] * (1 - chemistry_factor) + chemistry_factor
    return mlt


def construction_time_multiplier(player, facility):
    engine = current_app.config["engine"]
    # dilatation foactor dependent on clock_time
    mlt = (engine.clock_time / 60) ** 0.5
    # construction time increases with higher levels
    if facility in engine.functional_facilities + engine.technologies:
        mlt *= const_config["assets"][facility]["price multiplier"] ** (0.6 * getattr(player, facility))
    # knowledge spillover and laboratory time reduction
    if facility in engine.technologies:
        mlt *= 0.92 ** engine.data["technology_lvls"][facility][getattr(player, facility)]
        mlt *= const_config["assets"]["laboratory"]["time factor"] ** player.laboratory
    # building technology time reduction
    if (
        facility
        in engine.engine.storage_facilities
        + engine.controllable_facilities
        + engine.renewables
        + engine.extraction_facilities
        + engine.functional_facilities
    ):
        mlt *= const_config["assets"]["building_technology"]["time factor"] ** player.building_technology
    return mlt


def construction_power_multiplier(player, facility):
    engine = current_app.config["engine"]
    bt_factor = const_config["assets"]["building_technology"]["time factor"] ** player.building_technology
    # construction power in relation of facilities characteristics
    if facility in engine.controllable_facilities + engine.renewables + engine.extraction_facilities:
        return (
            const_config["assets"][facility]["construction power factor"]
            * power_multiplier(player, facility)
            / bt_factor
        )
    if facility in engine.storage_facilities:
        return (
            const_config["assets"][facility]["construction power factor"]
            * capacity_multiplier(player, facility)
            / bt_factor
        )
    mlt = (
        const_config["assets"][facility]["construction energy"]
        / const_config["assets"][facility]["construction time"]
        / construction_time_multiplier(player, facility)
        * 60
    )
    # construction power increases with higher levels
    if facility in engine.functional_facilities + engine.technologies:
        mlt *= const_config["assets"][facility]["price multiplier"] ** (1.2 * getattr(player, facility))
    # knowledge spillover
    if facility in engine.technologies:
        mlt *= 0.92 ** engine.data["technology_lvls"][facility][getattr(player, facility)]
    return mlt


def construction_pollution(player, facility):
    engine = current_app.config["engine"]
    mlt = 1
    # construction pollution increases with higher levels for functional facilities
    if facility in engine.functional_facilities:
        mlt *= const_config["assets"][facility]["price multiplier"] ** getattr(player, facility)
    return mlt


def lifespan_multiplier(player, facility):
    # dilatation foactor dependent on clock_time
    return (current_app.config["engine"].clock_time / 60) ** 0.5
