"""
Enums for the game.

Includes enums for worker types, fuel types, and renewable energy sources.
Planned future enums include facility names
"""

from enum import StrEnum


class WorkerType(StrEnum):
    """Enum for the worker type."""

    CONSTRUCTION = "Construction"
    RESEARCH = "Research"


class Fuel(StrEnum):
    """Enum for fuel names."""

    COAL = "coal"
    GAS = "gas"
    URANIUM = "uranium"

    def associated_mine(self) -> str:
        """Return the name of the mine associated with the fuel."""
        return {
            Fuel.COAL: "coal_mine",
            Fuel.GAS: "gas_drilling_site",
            Fuel.URANIUM: "uranium_mine",
        }[self]


class Renewable(StrEnum):
    """Enum for renewable energy sources."""

    SOLAR = "solar"
    WIND = "wind"
    HYDRO = "hydro"


# TODO(mglst): make this a method of the (upcoming) ExtractionFacility class
fuels_by_extraction_facility = {
    "coal_mine": Fuel.COAL,
    "gas_drilling_site": Fuel.GAS,
    "uranium_mine": Fuel.URANIUM,
}
