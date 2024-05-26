# This files contains all the functions to calculate the different parameters of facilities according to the technology levels of the player.

from .config import const_config

def price_multiplier(player, facility):
    """Function that returns the price multiplier according to the technology level of the player."""
    mlt = 1
    # Mechanical engineering
    if facility in const_config["assets"]["mechanical_engineering"]["affected facilities"]:
        mlt *= (const_config["assets"]["mechanical_engineering"]["price factor"] ** player.mechanical_engineering)
    # Physics
    if facility in const_config["assets"]["physics"]["affected facilities"]:
        mlt *= (const_config["assets"]["physics"]["price factor"] ** player.physics)
    # Mineral extraction
    if facility in const_config["assets"]["mineral_extraction"]["affected facilities"]:
        mlt *= (const_config["assets"]["mineral_extraction"]["price factor"] ** player.mineral_extraction)
    # Materials
    if facility in const_config["assets"]["materials"]["affected facilities"]:
        mlt *= (const_config["assets"]["materials"]["price factor"] ** player.materials)
    # Civil engineering
    if facility in const_config["assets"]["civil_engineering"]["affected facilities"]:
        mlt *= (const_config["assets"]["civil_engineering"]["price factor"] ** player.civil_engineering)
    # Aerodynamics
    if facility in const_config["assets"]["aerodynamics"]["affected facilities"]:
        mlt *= (const_config["assets"]["aerodynamics"]["price factor"] ** player.aerodynamics)
    # Chemistry
    if facility in const_config["assets"]["chemistry"]["affected facilities"]:
        mlt *= (const_config["assets"]["chemistry"]["price factor"] ** player.chemistry)
    # Nuclear engineering
    if facility in const_config["assets"]["nuclear_engineering"]["affected facilities"]:
        mlt *= (const_config["assets"]["nuclear_engineering"]["price factor"] ** player.nuclear_engineering)
    return mlt

def power_multiplier(player, facility):
    """Function that returns the power multiplier according to the technology level of the player."""
    mlt = 1
    # Mechanical engineering
    if facility in const_config["assets"]["mechanical_engineering"]["affected facilities"]:
        mlt *= (const_config["assets"]["mechanical_engineering"]["prod factor"] ** player.mechanical_engineering)
    # Physics
    if facility in const_config["assets"]["physics"]["affected facilities"]:
        mlt *= (const_config["assets"]["physics"]["prod factor"] ** player.physics)
    # Mineral extraction (in this case it is the energy consumption)
    if facility in const_config["assets"]["mineral_extraction"]["affected facilities"]:
        mlt *= (const_config["assets"]["mineral_extraction"]["energy factor"] ** player.mineral_extraction)
    # Materials (in this case it is the energy consumption for construction)
    if facility in const_config["assets"]["materials"]["affected facilities"]:
        mlt *= (const_config["assets"]["materials"]["construction energy factor"] ** player.materials)
    # Civil engineering
    if facility in const_config["assets"]["civil_engineering"]["affected facilities"]:
        mlt *= (const_config["assets"]["civil_engineering"]["prod factor"] ** player.civil_engineering)
    # Aerodynamics
    if facility in const_config["assets"]["aerodynamics"]["affected facilities"]:
        mlt *= (const_config["assets"]["aerodynamics"]["prod factor"] ** player.aerodynamics)
    # Nuclear engineering
    if facility in const_config["assets"]["nuclear_engineering"]["affected facilities"]:
        mlt *= (const_config["assets"]["nuclear_engineering"]["prod factor"] ** player.nuclear_engineering)
    return mlt

def capacity_multiplier(player, facility):
    """Function that returns the capacity multiplier according to the technology level of the player."""
    mlt = 1
    # Mineral extraction (in this case it is the extraction rate in fraction of total underground stock per minute)
    if facility in const_config["assets"]["mineral_extraction"]["affected facilities"]:
        mlt *= (const_config["assets"]["mineral_extraction"]["extract factor"] ** player.mineral_extraction)
    # Civil engineering
    if facility in ["small_pumped_hydro", "large_pumped_hydro"]:
        mlt *= (const_config["assets"]["civil_engineering"]["capacity factor"] ** player.civil_engineering)
    return mlt

def efficiency_multiplier(player, facility):
    """Function that returns the efficiency multiplier according to the technology level of the player."""
    mlt = 1
    # Thermodynamics
    if facility in const_config["assets"]["thermodynamics"]["affected facilities"]:
        thermodynamic_factor = const_config["assets"]["thermodynamics"]["efficiency_factor"] ** player.thermodynamics
        if facility == "compressed_air":
            return 0.8 / const_config["assets"][facility]["initial_efficiency"] * (1-1/thermodynamic_factor) + 1/thermodynamic_factor
        if facility == "molten_salt":
            return 1 / const_config["assets"][facility]["initial_efficiency"] * (1-1/thermodynamic_factor) + 1/thermodynamic_factor
        mlt *= thermodynamic_factor
    # Mineral extraction (in this case the the multiplicator is for emissions)
    if facility in const_config["assets"]["mineral_extraction"]["affected facilities"]:
        mlt *= (const_config["assets"]["mineral_extraction"]["pollution factor"] ** player.mineral_extraction)
    # Chemistry
    if facility in const_config["assets"]["chemistry"]["affected facilities"]:
        chemistry_factor = const_config["assets"]["chemistry"]["inefficiency_factor"] ** player.chemistry
        if facility == "hydrogen_storage":
            return 0.65 / const_config["assets"][facility]["initial_efficiency"] * (1-chemistry_factor) + chemistry_factor
        return 1 / const_config["assets"][facility]["initial_efficiency"] * (1-chemistry_factor) + chemistry_factor
    return mlt