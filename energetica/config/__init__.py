"""Main Config object and related loading method."""

import pathlib
from pydantic import BaseModel
from pydantic_yaml import parse_yaml_file_as
from energetica.config.base_project_config import BaseProjectConfig
from energetica.config.extraction_facility_config import ExtractionFacilitiesConfig
from energetica.config.functional_facility_config import FunctionalFacilitiesConfig
from energetica.config.level_project_config import LevelProjectConfig
from energetica.config.operating_facility_config import OperatingFacilityConfig
from energetica.config.power_facility_config import PowerFacilitiesConfig
from energetica.config.power_producing_facility_config import PowerProducingFacilityConfig
from energetica.config.seasonal_river_discharge_config import SeasonalRiverDischargeConfig
from energetica.config.storage_facility_config import StorageFacilitiesConfig
from energetica.config.technology_config import TechnologiesConfig
from energetica.config.wind_power_curve_config import WindPowerCurveConfig
from energetica.enums import (
    ExtractionFacilityType,
    FunctionalFacilityType,
    PowerFacilityType,
    ProjectType,
    StorageFacilityType,
    TechnologyType,
)


class Config(BaseModel):
    """
    Main config class for all configurable values of the game.
    It provides methods to retrieve specific configurations based on the project type.
    """

    power_facilities: PowerFacilitiesConfig
    storage_facilities: StorageFacilitiesConfig
    extraction_facilities: ExtractionFacilitiesConfig
    functional_facilities: FunctionalFacilitiesConfig
    technologies: TechnologiesConfig

    seasonal_river_discharge: SeasonalRiverDischargeConfig
    wind_power_curve: WindPowerCurveConfig

    def get_base_config(self, project_type: ProjectType) -> BaseProjectConfig:
        """Return the BaseProjectConfig for the specified ProjectType."""
        if isinstance(project_type, PowerFacilityType):
            return self.power_facilities[project_type]
        if isinstance(project_type, StorageFacilityType):
            return self.storage_facilities[project_type]
        if isinstance(project_type, ExtractionFacilityType):
            return self.extraction_facilities[project_type]
        if isinstance(project_type, FunctionalFacilityType):
            return self.functional_facilities[project_type]
        if isinstance(project_type, TechnologyType):
            return self.technologies[project_type]
        raise ValueError(f"Invalid facility type: {project_type}")

    def get_operating_config(
        self,
        project_type: PowerFacilityType | StorageFacilityType | ExtractionFacilityType,
    ) -> OperatingFacilityConfig:
        """Return the OperatingFacilityConfig for operating facilities."""
        if isinstance(project_type, PowerFacilityType):
            return self.power_facilities[project_type]
        if isinstance(project_type, StorageFacilityType):
            return self.storage_facilities[project_type]
        if isinstance(project_type, ExtractionFacilityType):
            return self.extraction_facilities[project_type]
        raise ValueError(f"Invalid facility type: {project_type}")

    def get_power_producing_config(
        self,
        project_type: PowerFacilityType | StorageFacilityType,
    ) -> PowerProducingFacilityConfig:
        """Return the PowerProducingFacilityConfig for power producing facilities."""
        if isinstance(project_type, PowerFacilityType):
            return self.power_facilities[project_type]
        if isinstance(project_type, StorageFacilityType):
            return self.storage_facilities[project_type]
        raise ValueError(f"Invalid facility type: {project_type}")

    def get_level_config(self, project_type: TechnologyType | FunctionalFacilityType) -> LevelProjectConfig:
        """Return the LevelProjectConfig for level based technologies and functional facilities."""
        if isinstance(project_type, TechnologyType):
            return self.technologies[project_type]
        if isinstance(project_type, FunctionalFacilityType):
            return self.functional_facilities[project_type]
        raise ValueError(f"Invalid facility type: {project_type}")


def load_config() -> Config:
    """Load the main Config object from disk."""
    return Config(
        power_facilities=parse_yaml_file_as(
            PowerFacilitiesConfig,
            "config/power-facilities.yaml",
        ),
        storage_facilities=parse_yaml_file_as(
            StorageFacilitiesConfig,
            "config/storage-facilities.yaml",
        ),
        extraction_facilities=parse_yaml_file_as(
            ExtractionFacilitiesConfig,
            "config/extraction-facilities.yaml",
        ),
        functional_facilities=parse_yaml_file_as(
            FunctionalFacilitiesConfig,
            "config/functional-facilities.yaml",
        ),
        technologies=parse_yaml_file_as(
            TechnologiesConfig,
            "config/technologies.yaml",
        ),
        wind_power_curve=WindPowerCurveConfig.model_validate_json(
            pathlib.Path("config/wind-power-curve.json").read_text(),
        ),
        seasonal_river_discharge=SeasonalRiverDischargeConfig.model_validate_json(
            pathlib.Path("config/seasonal-river-discharge.json").read_text(),
        ),
    )
