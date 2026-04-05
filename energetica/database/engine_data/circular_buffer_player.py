"""Module for the CircularBufferPlayer class."""

from collections import defaultdict, deque
from typing import Any


class CircularBufferPlayer:
    """Class that stores the active data of a player (last 360 ticks of the graph data)."""

    def __init__(self) -> None:
        """
        Initialize the engine data structure with default values.

        def create_deque():
            return deque([0.0] * 360, maxlen=360)
        self._data = {
            "revenues": defaultdict(create_deque),
            "op_costs": defaultdict(create_deque),
            "generation": defaultdict(create_deque),
            "demand": defaultdict(create_deque),
            "storage": defaultdict(create_deque),
            "resources": defaultdict(create_deque),
            "emissions": defaultdict(create_deque),
            "money": defaultdict(create_deque),
        }
        """
        # TODO (Yassir): Change to defaultdict
        self._data = {
            "revenues": {  # v - added dynamically - v
                "industry": deque([0.0] * 360, maxlen=360),
                "exports": deque([0.0] * 360, maxlen=360),
                "imports": deque([0.0] * 360, maxlen=360),
                "dumping": deque([0.0] * 360, maxlen=360),
                "climate_events": deque([0.0] * 360, maxlen=360),
            },
            "op_costs": {},  # + all facilities
            "generation": {
                "imports": deque([0.0] * 360, maxlen=360),  # + power and storage facilities
            },
            "demand": {
                "industry": deque([0.0] * 360, maxlen=360),
                "construction": deque([0.0] * 360, maxlen=360),
                "research": deque([0.0] * 360, maxlen=360),
                "transport": deque([0.0] * 360, maxlen=360),
                "exports": deque([0.0] * 360, maxlen=360),
                "dumping": deque([0.0] * 360, maxlen=360),  # + storage and extraction facilities
            },
            "storage": {},  # + storage facilities
            "storage_soc": {},  # + storage facilities (state of charge, 0-1 fraction)
            "resources": {},  # + all resources when warehouse is built
            "emissions": {
                "construction": deque([0.0] * 360, maxlen=360),  # + controllable facilities
            },
            "money": {
                "balance": deque([0.0] * 360, maxlen=360),
            },
        }

    def __setstate__(self, state: dict) -> None:
        """Migrate old pickle data by adding missing keys introduced in newer versions."""
        self.__dict__.update(state)
        fresh = CircularBufferPlayer()
        for key, default_subcategories in fresh._data.items():
            if key not in self._data:
                self._data[key] = {sub: deque([0.0] * 360, maxlen=360) for sub in default_subcategories}
        # storage_soc mirrors storage facilities, not just the defaults
        for facility in self._data.get("storage", {}):
            if facility not in self._data["storage_soc"]:
                self._data["storage_soc"][facility] = deque([0.0] * 360, maxlen=360)

    def append_value(self, new_value: dict) -> None:
        """Add one new tick of data to the buffer."""
        for category, subcategories in new_value.items():
            for subcategory, value in subcategories.items():
                self._data[category][subcategory].append(float(value))

    def add_subcategory(self, category: str, subcategory: str) -> None:
        """Add a new subcategory to the data."""
        if subcategory not in self._data[category]:
            self._data[category][subcategory] = deque([0.0] * 360, maxlen=360)
        if category == "storage" and subcategory not in self._data["storage_soc"]:
            self._data["storage_soc"][subcategory] = deque([0.0] * 360, maxlen=360)

    def get_data(self, t: int = 216) -> dict[str, dict[str, list[float]]]:
        """Return the last t ticks of the data."""
        result: dict[str, Any] = defaultdict(lambda: defaultdict(dict))
        for category, subcategories in self._data.items():
            for subcategory, buffer in subcategories.items():
                result[category][subcategory] = list(buffer)[-t:]
        return result

    def get_last_data(self, category: str, subcategory: str) -> float:
        """Return the last value of a subcategory."""
        if category in self._data and subcategory in self._data[category]:
            return self._data[category][subcategory][-1]
        return 0

    def init_new_data(self) -> dict:
        """
        Generate the new values for the data.

        Return a dict with the same structure as the data with 0 and with the last value for the storage and resources.
        """
        result: dict[str, Any] = {}
        for category, subcategories in self._data.items():
            result[category] = {}
            for subcategory, buffer in subcategories.items():
                if category in ["storage", "resources"]:
                    result[category][subcategory] = buffer[-1]
                else:
                    result[category][subcategory] = 0.0
        return result
