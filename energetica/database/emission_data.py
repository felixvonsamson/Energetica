"""Module for the EmissionData class and related functions."""

import math
from collections import defaultdict, deque

import noise

from energetica.globals import engine


def calculate_reference_gta(tick: int, seconds_per_tick: int) -> float:
    """Calculate the server's reference global average temperature."""
    month = tick * seconds_per_tick / 518_400
    return 13.65 - math.sin((month + 2) * math.pi / 6) * 1.9


def calculate_temperature_deviation(tick: int, seconds_per_tick: int, co2_levels: float, random_seed: int) -> float:
    """Calculate the GAT deviation from the CO2 levels."""
    ticks_per_year = 60 * 60 * 24 * 72 / seconds_per_tick
    temperature_deviation = (co2_levels - 4e10) / 1.33e10
    perlin1 = noise.pnoise1(tick / ticks_per_year, base=random_seed)
    perlin2 = noise.pnoise1(tick / ticks_per_year * 6, base=random_seed)
    perlin_disturbance = 0.4 * perlin1 + 0.1 * perlin2
    return temperature_deviation + perlin_disturbance


class EmissionData:
    """Class that stores the emission and climate data of the server."""

    def __init__(self, delta_t: int, spt: int, random_seed: int) -> None:
        ref_temp = []
        temp_deviation = []
        for t in range(delta_t - 360, delta_t):
            ref_temp.append(calculate_reference_gta(t + 1, spt))
            temp_deviation.append(calculate_temperature_deviation(t + 1, spt, 4e10, random_seed))
        self._data = {
            "emissions": {
                "CO2": deque([4e10] * 360, maxlen=360),  # base value of 5Mt of CO2 in the atmosphere
            },
            "temperature": {
                "reference": deque(ref_temp, maxlen=360),
                "deviation": deque(temp_deviation, maxlen=360),
            },
        }

    def get_data(self, t: int = 216) -> dict[str, dict]:
        """Return the last t ticks of the data."""
        result: dict[str, dict] = defaultdict(lambda: defaultdict(dict))
        for category, subcategories in self._data.items():
            for subcategory, buffer in subcategories.items():
                result[category][subcategory] = list(buffer)[-t:]
        return result

    def add(self, key: str, value: float) -> None:
        """Add a value to the data. Increasing the CO2 levels."""
        self._data["emissions"][key][-1] += value

    def init_new_value(self) -> None:
        """Generate the new values for CO2, reference temperature and temperature deviation."""
        # Keeping the CO2 levels form one tick to the next
        self._data["emissions"]["CO2"].append(self._data["emissions"]["CO2"][-1])
        # Calculating new temperatures
        t = engine.total_t + engine.delta_t
        self._data["temperature"]["reference"].append(calculate_reference_gta(t, engine.in_game_seconds_per_tick))
        self._data["temperature"]["deviation"].append(
            calculate_temperature_deviation(
                t,
                engine.in_game_seconds_per_tick,
                self._data["emissions"]["CO2"][0],
                engine.random_seed,
            ),
        )

    def get_last_data(self) -> dict[str, dict]:
        """Return the last value for each subcategory."""
        last_values: dict[str, dict] = {}
        for category, subcategories in self._data.items():
            last_values[category] = {}
            for subcategory, values in subcategories.items():
                last_values[category][subcategory] = values[-1]
        return last_values

    def get_co2(self) -> float:
        """Return the last value of the CO2 levels."""
        return self._data["emissions"]["CO2"][-1]
