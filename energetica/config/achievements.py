"""Config file containing the data for the achievements that can be unlocked by the player."""

achievements: dict = {
    "power_consumption": {
        "name": "Power Consumption",
        "metric": "max_power_consumption",
        "milestones": [10_000_000, 150_000_000, 6_500_000_000, 100_000_000_000, 3_000_000_000_000],
        "comparisons": [
            "a village in Europe",
            "the city of Basel",
            "Switzerland",
            "Japan",
            "the entire world population",
        ],
        "rewards": [5, 10, 15, 20, 25],  # XP
        "message": (
            "You have passed the milestone of {value} of power consumption. "
            "You consume as much electricity as {comparison}. (+{reward} XP)"
        ),
        "requirements": [],
    },
    "energy_storage": {
        "name": "Energy Storage",
        "metric": "max_energy_stored",
        "milestones": [8_000_000_000, 160_000_000_000, 5_000_000_000_000],
        "comparisons": ["Zurich for a day", "Switzerland for a day", "Switzerland for a month"],
        "rewards": [5, 10, 20],
        "message": ("You have stored {value} of energy, enough to power {comparison}. (+{reward} XP)"),
        "requirements": ["storage_facilities"],
    },
    "mineral_extraction": {
        "name": "Mineral Extraction",
        "metric": "extracted_resources",
        "milestones": [500_000, 10_000_000, 200_000_000],
        "rewards": [5, 10, 15],
        "message": ("You have extracted {value} of resources. (+{reward} XP)"),
        "requirements": ["warehouse", "laboratory"],
    },
    "network_import": {
        "name": "Network Import",
        "metric": "imported_energy",
        "milestones": [10_000_000_000, 200_000_000_000, 4_000_000_000_000],
        "rewards": [5, 10, 15],
        "message": ("You have imported more than {value} on the market. (+{reward} XP)"),
        "requirements": ["network"],
    },
    "network_export": {
        "name": "Network Export",
        "metric": "exported_energy",
        "milestones": [10_000_000_000, 200_000_000_000, 4_000_000_000_000],
        "rewards": [5, 10, 15],
        "message": ("You have exported more than {value} on the market. (+{reward} XP)"),
        "requirements": ["network"],
    },
    "technology": {
        "name": "Technology",
        "metric": "total_technologies",
        "milestones": [10, 25, 50, 100],
        "rewards": [5, 10, 15, 20],
        "message": ("You have researched a total of {value} levels of technologies. (+{reward} XP)"),
        "requirements": ["laboratory"],
    },
    "trading_export": {
        "name": "Resource Export",
        "metric": "sold_resources",
        "milestones": [200_000, 5_000_000, 100_000_000],
        "rewards": [5, 10, 15],
        "message": ("You have exported more than {value} of resources. (+{reward} XP)"),
        "requirements": ["warehouse"],
    },
    "trading_import": {
        "name": "Resource Import",
        "metric": "bought_resources",
        "milestones": [200_000, 5_000_000, 100_000_000],
        "rewards": [5, 10, 15],
        "message": ("You have imported more than {value} of resources. (+{reward} XP)"),
        "requirements": ["warehouse"],
    },
    "network": {
        "name": "Unlock Network",
        "metric": "max_power_consumption",
        "milestones": [3_000_000],
        "rewards": [1],
        "message": (
            "Your generation capacities are now big enough to join a network and trade electricity. "
            "See Community > Network. (+{reward} XP)"
        ),
        "requirements": [],
    },
    "laboratory": {
        "name": "Unlock Technologies",
        "unlocked_with": ["laboratory"],
        "reward": 1,
        "message": (
            "You have built a laboratory, you can now research technologies to unlock new facilities or improve existing ones. (+{reward} XP)"
        ),
        "requirements": [],
    },
    "warehouse": {
        "name": "Unlock Natural Resources",
        "unlocked_with": ["warehouse"],
        "reward": 1,
        "message": (
            "You have built a warehouse to store natural resources, you can now buy resources on the resource market or extract them yourself by building extraction facilities. (+{reward} XP)"
        ),
        "requirements": [],
    },
    "GHG_effect": {
        "name": "Discover the Greenhouse Effect",
        "unlocked_with": ["chemistry"],
        "reward": 5,
        "message": (
            "Scientists have discovered the greenhouse effect and have shown that climate change is caused by human activities and increases the risk of extreme weather events. You can now monitor your CO2 emissions and the climate anomalies in the emissions overview. (+{reward} XP)"
        ),
        "requirements": ["laboratory"],
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
        "reward": 1,
        "message": (
            "You have built your first storage facility, you can monitor the stored energy in the energy storage overview. (+{reward} XP)"
        ),
        "requirements": [],
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
