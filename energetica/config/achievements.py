"""Config file containing the data for the achievements that can be unlocked by the player."""

achievements: dict = {
    "power_consumption": {
        "name": "Power Consumption",
        "metric": "max_power_consumption",
        "milestones": [
            {"threshold": 10_000_000, "xp": 5, "comparison_key": "village-in-europe"},
            {"threshold": 150_000_000, "xp": 10, "comparison_key": "city-of-basel"},
            {"threshold": 6_500_000_000, "xp": 15, "comparison_key": "switzerland"},
            {"threshold": 100_000_000_000, "xp": 20, "comparison_key": "japan"},
            {"threshold": 3_000_000_000_000, "xp": 25, "comparison_key": "world-population"},
        ],
        "requirements": [],
    },
    "energy_storage": {
        "name": "Energy Storage",
        "metric": "max_energy_stored",
        "milestones": [
            {"threshold": 8_000_000_000, "xp": 5, "comparison_key": "zurich-for-a-day"},
            {"threshold": 160_000_000_000, "xp": 10, "comparison_key": "switzerland-for-a-day"},
            {"threshold": 5_000_000_000_000, "xp": 20, "comparison_key": "switzerland-for-a-month"},
        ],
        "requirements": ["storage_facilities"],
    },
    "mineral_extraction": {
        "name": "Mineral Extraction",
        "metric": "extracted_resources",
        "milestones": [
            {"threshold": 500_000, "xp": 5},
            {"threshold": 10_000_000, "xp": 10},
            {"threshold": 200_000_000, "xp": 15},
        ],
        "requirements": ["warehouse", "laboratory"],
    },
    "network_import": {
        "name": "Network Import",
        "metric": "imported_energy",
        "milestones": [
            {"threshold": 10_000_000_000, "xp": 5},
            {"threshold": 200_000_000_000, "xp": 10},
            {"threshold": 4_000_000_000_000, "xp": 15},
        ],
        "requirements": ["network"],
    },
    "network_export": {
        "name": "Network Export",
        "metric": "exported_energy",
        "milestones": [
            {"threshold": 10_000_000_000, "xp": 5},
            {"threshold": 200_000_000_000, "xp": 10},
            {"threshold": 4_000_000_000_000, "xp": 15},
        ],
        "requirements": ["network"],
    },
    "technology": {
        "name": "Technology",
        "metric": "total_technologies",
        "milestones": [
            {"threshold": 10, "xp": 5},
            {"threshold": 25, "xp": 10},
            {"threshold": 50, "xp": 15},
            {"threshold": 100, "xp": 20},
        ],
        "requirements": ["laboratory"],
    },
    "trading_export": {
        "name": "Resource Export",
        "metric": "sold_resources",
        "milestones": [
            {"threshold": 200_000, "xp": 5},
            {"threshold": 5_000_000, "xp": 10},
            {"threshold": 100_000_000, "xp": 15},
        ],
        "requirements": ["warehouse"],
    },
    "trading_import": {
        "name": "Resource Import",
        "metric": "bought_resources",
        "milestones": [
            {"threshold": 200_000, "xp": 5},
            {"threshold": 5_000_000, "xp": 10},
            {"threshold": 100_000_000, "xp": 15},
        ],
        "requirements": ["warehouse"],
    },
    "network": {
        "name": "Unlock Network",
        "metric": "max_power_consumption",
        "milestones": [
            {"threshold": 3_000_000, "xp": 1},
        ],
        "requirements": [],
    },
    "laboratory": {
        "name": "Unlock Technologies",
        "unlocked_with": ["laboratory"],
        "xp": 1,
        "requirements": [],
    },
    "warehouse": {
        "name": "Unlock Natural Resources",
        "unlocked_with": ["warehouse"],
        "xp": 1,
        "requirements": [],
    },
    "storage_facilities": {
        "name": "First Storage Facility",
        "unlocked_with": [
            "small_pumped_hydro",
            "molten_salt",
            "large_pumped_hydro",
            "hydrogen_storage",
            "lithium_ion_batteries",
            "solid_state_batteries",
        ],
        "xp": 1,
        "requirements": [],
    },
    "GHG_effect": {
        "name": "Discover the Greenhouse Effect",
        "unlocked_with": ["chemistry"],
        "xp": 5,
        "requirements": ["laboratory"],
    },
}

# Taken an adapted from display_functions.js

_power_units = [" W", " kW", " MW", " GW", " TW"]
_energy_units = [" Wh", " kWh", " MWh", " GWh", " TWh"]
_mass_units = [" kg", " t", " kt", " Mt"]


def general_format(value: float, units: list[str], threshold: int = 10_000) -> str:
    # Inserts thousands separator and the right unit
    unit_index = 0
    while abs(value) >= threshold and unit_index < len(units) - 1:
        value /= 1_000
        unit_index += 1
    formatted = f"{int(round(value)):,}".replace(",", "'")
    return f"{formatted}{units[unit_index]}"


def format_power(power: float, threshold: int = 10_000) -> str:  # noqa: ANN201
    return general_format(power, _power_units, threshold)


def format_power_special(energy: float, interval: float) -> str:
    # Special format for x-ticks for zoomed in market graph with more precision
    unit_index = 0
    while energy >= 10_000 and unit_index < len(_power_units) - 1:
        energy /= 1_000
        interval /= 1_000
        unit_index += 1
    decimal_places = len(str(interval).split(".")[1]) if "." in str(interval) else 0
    energy_str = f"{energy:.{decimal_places}f}"
    integer_part, _, decimal_part = energy_str.partition(".")
    integer_part = f"{int(integer_part):,}".replace(",", "'")
    return f"{integer_part}{'.' + decimal_part if decimal_part else ''}{_power_units[unit_index]}"


def format_energy(energy: float, threshold: int = 10_000) -> str:
    return general_format(energy, _energy_units, threshold)


def format_mass(mass: float, threshold: int = 10_000) -> str:
    return general_format(mass, _mass_units, threshold)
