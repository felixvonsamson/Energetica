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


class WindFacility(StrEnum):
    """Enum for wind facilities."""

    WINDMILL = "windmill"
    ONSHORE_WIND_TURBINE = "onshore_wind_turbine"
    OFFSHORE_WIND_TURBINE = "offshore_wind_turbine"


class HydroFacility(StrEnum):
    """Enum for hydro facilities."""

    WATERMILL = "watermill"
    SMALL_WATER_DAM = "small_water_dam"
    LARGE_WATER_DAM = "large_water_dam"


class SolarFacility(StrEnum):
    """Enum for solar facilities."""

    CSP_SOLAR = "CSP_solar"
    PV_SOLAR = "PV_solar"


class ControllableFacility(StrEnum):
    """Enum for controllable facilities."""

    STEAM_ENGINE = "steam_engine"
    COAL_BURNER = "coal_burner"
    GAS_BURNER = "gas_burner"
    COMBINED_CYCLE = "combined_cycle"
    NUCLEAR_REACTOR = "nuclear_reactor"
    NUCLEAR_REACTOR_GEN4 = "nuclear_reactor_gen4"


class StorageFacility(StrEnum):
    """Enum for storage facilities."""

    SMALL_PUMPED_HYDRO = "small_pumped_hydro"
    MOLTEN_SALT = "molten_salt"
    LARGE_PUMPED_HYDRO = "large_pumped_hydro"
    HYDROGEN_STORAGE = "hydrogen_storage"
    LITHIUM_ION_BATTERIES = "lithium_ion_batteries"
    SOLID_STATE_BATTERIES = "solid_state_batteries"


class ExtractionFacility(StrEnum):
    """Enum for extraction facilities."""

    COAL_MINE = "coal_mine"
    GAS_DRILLING_SITE = "gas_drilling_site"
    URANIUM_MINE = "uranium_mine"

    @property
    def associated_fuel(self) -> Fuel:
        """Return the fuel associated with the project."""
        return {
            ExtractionFacility.COAL_MINE: Fuel.COAL,
            ExtractionFacility.GAS_DRILLING_SITE: Fuel.GAS,
            ExtractionFacility.URANIUM_MINE: Fuel.URANIUM,
        }[self]


class FunctionalFacility(StrEnum):
    """Enum for functional facilities."""

    INDUSTRY = "industry"
    LABORATORY = "laboratory"  # Note: this name should not be used for ask prices, use RESEARCH instead
    WAREHOUSE = "warehouse"
    CARBON_CAPTURE = "carbon_capture"


class Technology(StrEnum):
    """Enum for technologies."""

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


class SpecialAsk(StrEnum):
    """Enum for special asks on the market."""

    CONSTRUCTION = "construction"
    RESEARCH = "research"  # Note: see LABORATORY above. Arguably, these should be merged into one
    TRANSPORT = "transport"


RenewableFacility = WindFacility | HydroFacility | SolarFacility

renewables = [  # rename to renewable_facilities
    HydroFacility.SMALL_WATER_DAM,
    HydroFacility.LARGE_WATER_DAM,
    HydroFacility.WATERMILL,
    WindFacility.ONSHORE_WIND_TURBINE,
    WindFacility.OFFSHORE_WIND_TURBINE,
    WindFacility.WINDMILL,
    SolarFacility.CSP_SOLAR,
    SolarFacility.PV_SOLAR,
]

PowerFacility = RenewableFacility | ControllableFacility

power_facility_types: list[PowerFacility] = [
    ControllableFacility.STEAM_ENGINE,
    WindFacility.WINDMILL,
    HydroFacility.WATERMILL,
    ControllableFacility.COAL_BURNER,
    ControllableFacility.GAS_BURNER,
    HydroFacility.SMALL_WATER_DAM,
    WindFacility.ONSHORE_WIND_TURBINE,
    ControllableFacility.COMBINED_CYCLE,
    ControllableFacility.NUCLEAR_REACTOR,
    HydroFacility.LARGE_WATER_DAM,
    SolarFacility.CSP_SOLAR,
    SolarFacility.PV_SOLAR,
    WindFacility.OFFSHORE_WIND_TURBINE,
    ControllableFacility.NUCLEAR_REACTOR_GEN4,
]

# rename to ProjectType, along with all the others (and project_types)
ProjectName = PowerFacility | StorageFacility | ExtractionFacility | FunctionalFacility | Technology
project_names: set[ProjectName] = (
    set(power_facility_types)
    | set(StorageFacility)
    | set(ExtractionFacility)
    | set(FunctionalFacility)
    | set(Technology)
)


print(ControllableFacility.COAL_BURNER.name)  # coal_burner

# str_to_project_name = {f.name: f for sub in ProjectName.__args__ for f in sub}

project_set = {f for sub in ProjectName.__args__ for f in sub}

str_to_project_name: dict[str, ProjectName | SpecialAsk] = {str(f): f for f in (project_names | set(SpecialAsk))}
