"""Config file containing the data for the climate events that can occur in the game."""

from datetime import timedelta

from energetica.enums import (
    ControllableFacilityType,
    HydroFacilityType,
    PowerFacilityType,
    SolarFacilityType,
    StorageFacilityType,
    WindFacilityType,
)


class ClimateEvent:
    """Class representing a climate event."""

    def __init__(
        self,
        name: str,
        base_probability: float,
        cost_fraction: float,
        duration: float,
        affected_tiles_radius: int,
        destruction_chance: dict[PowerFacilityType | StorageFacilityType, float],
        industry_destruction_chance: float,
    ):
        self.name = name
        self.base_probability = base_probability
        self.cost_fraction = cost_fraction
        self.duration = duration
        self.affected_tiles_radius = affected_tiles_radius
        self.destruction_chance = destruction_chance
        self.industry_destruction_chance = industry_destruction_chance

    @property
    def description(self) -> str:
        """A description of the climate event to be displayed to the player."""
        second_part = (
            "and is impacting the population."
            if self.name in ["Heat wave", "Cold wave"]
            else "and destroyed some parts of the infrastructure."
        )
        return (
            f"A {self.name.lower} has occurred and {second_part} "
            f"The recovery from this event will take {self.duration / 3600 / 24} days and "
            f"cost {self.cost_fraction * 100:.2f}% of the player's industry revenue."
        )


climate_events = {
    "flood": ClimateEvent(
        name="Flood",
        base_probability=0.2,
        cost_fraction=0.25,
        duration=timedelta(days=8).total_seconds(),
        affected_tiles_radius=1,
        destruction_chance={
            HydroFacilityType.WATERMILL: 0.6,
            HydroFacilityType.SMALL_WATER_DAM: 0.05,  # destruction affects the 3 downstream tiles
            HydroFacilityType.LARGE_WATER_DAM: 0.02,  # destruction affects the 15 downstream tiles
            ControllableFacilityType.STEAM_ENGINE: 0.05,
            ControllableFacilityType.COAL_BURNER: 0.03,
            ControllableFacilityType.GAS_BURNER: 0.03,
            ControllableFacilityType.COMBINED_CYCLE: 0.02,
            ControllableFacilityType.NUCLEAR_REACTOR: 0.01,  # not a dangerous accident but the plant has to be shut down permanently for safety reasons
            # safety reasons
            ControllableFacilityType.NUCLEAR_REACTOR_GEN4: 0.005,  # not a dangerous accident but the plant has to be shut down permanently for
            # safety reasons
        },
        industry_destruction_chance=0.5,
    ),
    "heat_wave": ClimateEvent(
        name="Heat wave",
        base_probability=0.35,
        cost_fraction=0.15,
        duration=timedelta(days=4).total_seconds(),
        affected_tiles_radius=2,
        destruction_chance={
            StorageFacilityType.LITHIUM_ION_BATTERIES: 0.05,
            StorageFacilityType.SOLID_STATE_BATTERIES: 0.02,
        },
        industry_destruction_chance=0,
    ),
    "cold_wave": ClimateEvent(
        name="Cold wave",
        base_probability=0.35,
        cost_fraction=0.15,
        duration=timedelta(days=4).total_seconds(),
        affected_tiles_radius=2,
        destruction_chance={},
        industry_destruction_chance=0,
    ),
    "hurricane": ClimateEvent(
        name="Hurricane",
        base_probability=0.05,
        cost_fraction=0.4,
        duration=timedelta(days=9).total_seconds(),
        affected_tiles_radius=3,
        destruction_chance={
            WindFacilityType.WINDMILL: 0.5,
            WindFacilityType.ONSHORE_WIND_TURBINE: 0.3,
            WindFacilityType.OFFSHORE_WIND_TURBINE: 0.2,
            SolarFacilityType.PV_SOLAR: 0.1,
            SolarFacilityType.CSP_SOLAR: 0.15,
        },
        industry_destruction_chance=0.9,
    ),
    "wildfire": ClimateEvent(
        name="Wildfire",
        base_probability=0.25,
        cost_fraction=0.3,
        duration=timedelta(days=3).total_seconds(),
        affected_tiles_radius=2,
        destruction_chance={
            WindFacilityType.WINDMILL: 0.1,
            WindFacilityType.ONSHORE_WIND_TURBINE: 0.05,
            HydroFacilityType.WATERMILL: 0.05,
            ControllableFacilityType.STEAM_ENGINE: 0.02,
            ControllableFacilityType.COAL_BURNER: 0.02,
            ControllableFacilityType.GAS_BURNER: 0.02,
            ControllableFacilityType.COMBINED_CYCLE: 0.02,
            SolarFacilityType.PV_SOLAR: 0.05,
            SolarFacilityType.CSP_SOLAR: 0.02,
        },
        industry_destruction_chance=0.3,
    ),
}
