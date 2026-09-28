"""Module for the CircularBufferNetwork class."""

from collections import defaultdict, deque


class CircularBufferNetwork:
    """Class that stores the active data of a Network."""

    def __init__(self) -> None:
        self._data = {
            "network_data": {
                "price": deque([0.0] * 360, maxlen=360),
                "quantity": deque([0.0] * 360, maxlen=360),
            },
            "exports": {},  # exports for each player
            "imports": {},  # imports for each player
            "generation": {},  # generation for each type (ex: "steam_engine")
            "consumption": {},  # consumption for each type (ex: "industry")
        }

    def append_value(self, new_value: dict) -> None:
        """Add one new tick of data to the buffer."""
        for category, category_value in self._data.items():
            for group, value in new_value[category].items():
                if group not in category_value:
                    category_value[group] = deque([0.0] * 360, maxlen=360)
                category_value[group].append(float(value))
            for group, value in category_value.items():
                if group not in new_value[category]:
                    value.append(0.0)

    def get_data(self, t: int = 216) -> dict[str, dict]:
        """Return the last t ticks of the data."""
        result: dict[str, dict] = defaultdict(lambda: defaultdict(dict))
        for category, value in self._data.items():
            for group, buffer in value.items():
                result[category][group] = list(buffer)[-t:]
        return result
