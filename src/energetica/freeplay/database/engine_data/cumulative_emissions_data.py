"""Module for the CumulativeEmissionsData class."""


class CumulativeEmissionsData:
    """Class storing the cumulative emissions of all facilities of a player."""

    def __init__(self) -> None:
        self._data: dict[str, float] = {
            "steam_engine": 0.0,
            "construction": 0.0,
        }

    def add(self, facility: str, value: float) -> None:
        """Add a value to the data."""
        self._data[facility] += value

    def add_category(self, facility: str) -> None:
        """Add a new category to the data."""
        if facility not in self._data:
            self._data[facility] = 0.0

    def __getitem__(self, facility: str) -> float | None:
        """Return the data of a facility."""
        if facility not in self._data:
            return None
        return self._data[facility]

    def get_all(self) -> dict[str, float]:
        """Return the data."""
        return self._data
