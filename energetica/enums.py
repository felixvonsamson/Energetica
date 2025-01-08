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


class ProjectName(StrEnum):
    """
    Enum for all projects in the game.

    Namely: power, storage, extraction, and functional facilities, and technologies
    """

    # Power facilities
    STEAM_ENGINE = "steam_engine"
    WINDMILL = "windmill"
    WATERMILL = "watermill"
    COAL_BURNER = "coal_burner"
    GAS_BURNER = "gas_burner"
    SMALL_WATER_DAM = "small_water_dam"
    ONSHORE_WIND_TURBINE = "onshore_wind_turbine"
    COMBINED_CYCLE = "combined_cycle"
    NUCLEAR_REACTOR = "nuclear_reactor"
    LARGE_WATER_DAM = "large_water_dam"
    CSP_SOLAR = "CSP_solar"
    PV_SOLAR = "PV_solar"
    OFFSHORE_WIND_TURBINE = "offshore_wind_turbine"
    NUCLEAR_REACTOR_GEN4 = "nuclear_reactor_gen4"

    # Extraction facilities
    COAL_MINE = "coal_mine"
    GAS_DRILLING_SITE = "gas_drilling_site"
    URANIUM_MINE = "uranium_mine"

    # Storage facilities
    SMALL_PUMPED_HYDRO = "small_pumped_hydro"
    MOLTEN_SALT = "molten_salt"
    LARGE_PUMPED_HYDRO = "large_pumped_hydro"
    HYDROGEN_STORAGE = "hydrogen_storage"
    LITHIUM_ION_BATTERIES = "lithium_ion_batteries"
    SOLID_STATE_BATTERIES = "solid_state_batteries"

    # Functional facilities
    INDUSTRY = "industry"
    LABORATORY = "laboratory"  # Note: this name should not be used for ask prices, use RESEARCH instead
    WAREHOUSE = "warehouse"
    CARBON_CAPTURE = "carbon_capture"

    # Technologies
    MATHEMATICS = "mathematics"
    MECHANICAL_ENGINEERING = "mechanical_engineering"
    THERMODYNAMICS = "thermodynamics"
    PHYSICS = "physics"
    BUILDING_TECHNOLOGY = "building_technology"
    MINERAL_EXTRACTION = "mineral_extraction"
    TRANSPORT_TECHNOLOGY = "transport_technology"
    MATERIALS = "materials"
    CIVIL_ENGINEERING = "civil_engineering"
    AERODYNAMICS = "aerodynamics"
    CHEMISTRY = "chemistry"
    NUCLEAR_ENGINEERING = "nuclear_engineering"

    # Special power demand, used for asks on the market
    # Industry is not included here because it already appears above as a functional facility
    CONSTRUCTION = "construction"
    RESEARCH = "research"  # Note: see LABORATORY above. Arguably, these should be merged into one
    TRANSPORT = "transport"

    @property
    def associated_fuel(self) -> Fuel:
        """Return the fuel associated with the project."""
        return {
            ProjectName.COAL_MINE: Fuel.COAL,
            ProjectName.GAS_DRILLING_SITE: Fuel.GAS,
            ProjectName.URANIUM_MINE: Fuel.URANIUM,
        }[self]


power_facilities = [
    ProjectName.STEAM_ENGINE,
    ProjectName.WINDMILL,
    ProjectName.WATERMILL,
    ProjectName.COAL_BURNER,
    ProjectName.GAS_BURNER,
    ProjectName.SMALL_WATER_DAM,
    ProjectName.ONSHORE_WIND_TURBINE,
    ProjectName.COMBINED_CYCLE,
    ProjectName.NUCLEAR_REACTOR,
    ProjectName.LARGE_WATER_DAM,
    ProjectName.CSP_SOLAR,
    ProjectName.PV_SOLAR,
    ProjectName.OFFSHORE_WIND_TURBINE,
    ProjectName.NUCLEAR_REACTOR_GEN4,
]


controllable_facilities = [
    ProjectName.STEAM_ENGINE,
    ProjectName.NUCLEAR_REACTOR,
    ProjectName.NUCLEAR_REACTOR_GEN4,
    ProjectName.COMBINED_CYCLE,
    ProjectName.GAS_BURNER,
    ProjectName.COAL_BURNER,
]

renewables = [
    ProjectName.SMALL_WATER_DAM,
    ProjectName.LARGE_WATER_DAM,
    ProjectName.WATERMILL,
    ProjectName.ONSHORE_WIND_TURBINE,
    ProjectName.OFFSHORE_WIND_TURBINE,
    ProjectName.WINDMILL,
    ProjectName.CSP_SOLAR,
    ProjectName.PV_SOLAR,
]

extraction_facilities = [
    ProjectName.COAL_MINE,
    ProjectName.GAS_DRILLING_SITE,
    ProjectName.URANIUM_MINE,
]

storage_facilities = [
    ProjectName.SMALL_PUMPED_HYDRO,
    ProjectName.MOLTEN_SALT,
    ProjectName.LARGE_PUMPED_HYDRO,
    ProjectName.HYDROGEN_STORAGE,
    ProjectName.LITHIUM_ION_BATTERIES,
    ProjectName.SOLID_STATE_BATTERIES,
]

functional_facilities = [
    ProjectName.INDUSTRY,
    ProjectName.LABORATORY,
    ProjectName.WAREHOUSE,
    ProjectName.CARBON_CAPTURE,
]

technologies = [
    ProjectName.MATHEMATICS,
    ProjectName.MECHANICAL_ENGINEERING,
    ProjectName.THERMODYNAMICS,
    ProjectName.PHYSICS,
    ProjectName.BUILDING_TECHNOLOGY,
    ProjectName.MINERAL_EXTRACTION,
    ProjectName.TRANSPORT_TECHNOLOGY,
    ProjectName.MATERIALS,
    ProjectName.CIVIL_ENGINEERING,
    ProjectName.AERODYNAMICS,
    ProjectName.CHEMISTRY,
    ProjectName.NUCLEAR_ENGINEERING,
]

facilities = power_facilities + extraction_facilities + storage_facilities + functional_facilities


# TODO(mglst): make this a method of the (upcoming) ExtractionFacility class
fuels_by_extraction_facility = {
    "coal_mine": Fuel.COAL,
    "gas_drilling_site": Fuel.GAS,
    "uranium_mine": Fuel.URANIUM,
}
