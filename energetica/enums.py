"""
Enums for the game.

Includes enums for worker types, fuel types, and renewable energy sources.
Planned future enums include facility names
"""

from __future__ import annotations

from enum import StrEnum


class WorkerType(StrEnum):
    """Enum for the worker type."""

    CONSTRUCTION = "construction"
    RESEARCH = "research"

    @staticmethod
    def lab_workers_for_level(laboratory_level: int) -> int:
        """Returns how many lab workers are available for the specified lab level."""
        return (laboratory_level + 2) // 3

    @staticmethod
    def construction_workers_for_level(building_technology_level: int) -> int:
        """Returns how many construction workers are available for the specified building technology level."""
        return building_technology_level + 1


class Fuel(StrEnum):
    """Enum for fuel names."""

    COAL = "coal"
    GAS = "gas"
    URANIUM = "uranium"

    @property
    def associated_mine(self) -> ExtractionFacilityType:
        """Return the name of the mine associated with the fuel."""
        return {
            Fuel.COAL: ExtractionFacilityType.COAL_MINE,
            Fuel.GAS: ExtractionFacilityType.GAS_DRILLING_SITE,
            Fuel.URANIUM: ExtractionFacilityType.URANIUM_MINE,
        }[self]


class Renewable(StrEnum):
    """Enum for renewable energy sources."""

    SOLAR = "solar"
    WIND = "wind"
    HYDRO = "hydro"


class WindFacilityType(StrEnum):
    """Enum for wind facilities."""

    WINDMILL = "windmill"
    ONSHORE_WIND_TURBINE = "onshore_wind_turbine"
    OFFSHORE_WIND_TURBINE = "offshore_wind_turbine"

    @property
    def worker_type(self) -> WorkerType:
        """Return the worker type associated with the project."""
        return WorkerType.CONSTRUCTION


class HydroFacilityType(StrEnum):
    """Enum for hydro facilities."""

    WATERMILL = "watermill"
    SMALL_WATER_DAM = "small_water_dam"
    LARGE_WATER_DAM = "large_water_dam"

    @property
    def worker_type(self) -> WorkerType:
        """Return the worker type associated with the project."""
        return WorkerType.CONSTRUCTION


class SolarFacilityType(StrEnum):
    """Enum for solar facilities."""

    CSP_SOLAR = "CSP_solar"
    PV_SOLAR = "PV_solar"

    @property
    def worker_type(self) -> WorkerType:
        """Return the worker type associated with the project."""
        return WorkerType.CONSTRUCTION


class ControllableFacilityType(StrEnum):
    """Enum for controllable facilities."""

    STEAM_ENGINE = "steam_engine"
    COAL_BURNER = "coal_burner"
    GAS_BURNER = "gas_burner"
    COMBINED_CYCLE = "combined_cycle"
    NUCLEAR_REACTOR = "nuclear_reactor"
    NUCLEAR_REACTOR_GEN4 = "nuclear_reactor_gen4"

    @property
    def worker_type(self) -> WorkerType:
        """Return the worker type associated with the project."""
        return WorkerType.CONSTRUCTION


class StorageFacilityType(StrEnum):
    """Enum for storage facilities."""

    SMALL_PUMPED_HYDRO = "small_pumped_hydro"
    MOLTEN_SALT = "molten_salt"
    LARGE_PUMPED_HYDRO = "large_pumped_hydro"
    HYDROGEN_STORAGE = "hydrogen_storage"
    LITHIUM_ION_BATTERIES = "lithium_ion_batteries"
    SOLID_STATE_BATTERIES = "solid_state_batteries"

    @property
    def worker_type(self) -> WorkerType:
        """Return the worker type associated with the project."""
        return WorkerType.CONSTRUCTION


class ExtractionFacilityType(StrEnum):
    """Enum for extraction facilities."""

    COAL_MINE = "coal_mine"
    GAS_DRILLING_SITE = "gas_drilling_site"
    URANIUM_MINE = "uranium_mine"

    @property
    def worker_type(self) -> WorkerType:
        """Return the worker type associated with the project."""
        return WorkerType.CONSTRUCTION

    @property
    def associated_fuel(self) -> Fuel:
        """Return the fuel associated with the project."""
        return {
            ExtractionFacilityType.COAL_MINE: Fuel.COAL,
            ExtractionFacilityType.GAS_DRILLING_SITE: Fuel.GAS,
            ExtractionFacilityType.URANIUM_MINE: Fuel.URANIUM,
        }[self]


class FunctionalFacilityType(StrEnum):
    """Enum for functional facilities."""

    INDUSTRY = "industry"
    LABORATORY = "laboratory"  # Note: this name should not be used for ask prices, use RESEARCH instead
    WAREHOUSE = "warehouse"
    CARBON_CAPTURE = "carbon_capture"

    @property
    def worker_type(self) -> WorkerType:
        """Return the worker type associated with the project."""
        return WorkerType.CONSTRUCTION


class TechnologyType(StrEnum):
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

    @property
    def worker_type(self) -> WorkerType:
        """Return the worker type associated with the project."""
        return WorkerType.RESEARCH


class NonFacilityBidType(StrEnum):
    """Enum for special asks on the market that are not storage, extraction, or functional facilities."""

    CONSTRUCTION = "construction"
    RESEARCH = "research"  # Note: see LABORATORY above. Arguably, these should be merged into one
    TRANSPORT = "transport"


RenewableFacilityType = WindFacilityType | HydroFacilityType | SolarFacilityType

renewable_facility_types = [
    HydroFacilityType.SMALL_WATER_DAM,
    HydroFacilityType.LARGE_WATER_DAM,
    HydroFacilityType.WATERMILL,
    WindFacilityType.ONSHORE_WIND_TURBINE,
    WindFacilityType.OFFSHORE_WIND_TURBINE,
    WindFacilityType.WINDMILL,
    SolarFacilityType.CSP_SOLAR,
    SolarFacilityType.PV_SOLAR,
]

PowerFacilityType = RenewableFacilityType | ControllableFacilityType

power_facility_types: list[PowerFacilityType] = [
    ControllableFacilityType.STEAM_ENGINE,
    WindFacilityType.WINDMILL,
    HydroFacilityType.WATERMILL,
    ControllableFacilityType.COAL_BURNER,
    ControllableFacilityType.GAS_BURNER,
    HydroFacilityType.SMALL_WATER_DAM,
    WindFacilityType.ONSHORE_WIND_TURBINE,
    ControllableFacilityType.COMBINED_CYCLE,
    ControllableFacilityType.NUCLEAR_REACTOR,
    HydroFacilityType.LARGE_WATER_DAM,
    SolarFacilityType.CSP_SOLAR,
    SolarFacilityType.PV_SOLAR,
    WindFacilityType.OFFSHORE_WIND_TURBINE,
    ControllableFacilityType.NUCLEAR_REACTOR_GEN4,
]

ProjectType = PowerFacilityType | StorageFacilityType | ExtractionFacilityType | FunctionalFacilityType | TechnologyType
project_types: set[ProjectType] = {
    *power_facility_types,
    *StorageFacilityType,
    *ExtractionFacilityType,
    *FunctionalFacilityType,
    *TechnologyType,
}

str_to_project_type: dict[str, ProjectType] = {str(f): f for f in (project_types)}

project_types_extended: set[ProjectType | NonFacilityBidType] = project_types | set(NonFacilityBidType)
str_to_project_type_extended: dict[str, ProjectType | NonFacilityBidType] = {str(f): f for f in project_types_extended}


class ProjectStatus(StrEnum):
    """Class that stores the status of ongoing projects."""

    PAUSED = "paused"
    WAITING = "waiting"
    ONGOING = "ongoing"

    @classmethod
    def _missing_(cls, value: object) -> ProjectStatus | None:
        """Backward compatibility: handle old IntEnum values (0=paused, 1=waiting, 2=ongoing)."""
        _legacy = {0: cls.PAUSED, 1: cls.WAITING, 2: cls.ONGOING}
        return _legacy.get(value)  # type: ignore[arg-type]
