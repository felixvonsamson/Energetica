""""""

import json

from energetica.config.extraction_facility_config import ExtractionFacilitiesConfig
from energetica.config.functional_facility_config import FunctionalFacilitiesConfig
from energetica.config.power_facility_config import PowerFacilitiesConfig
from energetica.config.seasonal_river_discharge_config import SeasonalRiverDischargeConfig
from energetica.config.storage_facility_config import StorageFacilitiesConfig
from energetica.config.technology_config import TechnologiesConfig
from energetica.config.wind_power_curve_config import WindPowerCurveConfig


with open("./energetica/schemas/config/power-facilities-schema.json", "w") as f:
    json.dump(PowerFacilitiesConfig.model_json_schema(), f, indent=4)

with open("./energetica/schemas/config/storage-facilities-schema.json", "w") as f:
    json.dump(StorageFacilitiesConfig.model_json_schema(), f, indent=4)

with open("./energetica/schemas/config/extraction-facilities-schema.json", "w") as f:
    json.dump(ExtractionFacilitiesConfig.model_json_schema(), f, indent=4)

with open("./energetica/schemas/config/functional-facilities-schema.json", "w") as f:
    json.dump(FunctionalFacilitiesConfig.model_json_schema(), f, indent=4)

with open("./energetica/schemas/config/technologies-schema.json", "w") as f:
    json.dump(TechnologiesConfig.model_json_schema(), f, indent=4)

with open("./energetica/schemas/config/seasonal-river-discharge-schema.json", "w") as f:
    json.dump(SeasonalRiverDischargeConfig.model_json_schema(), f, indent=4)

with open("./energetica/schemas/config/wind-power-curve-schema.json", "w") as f:
    json.dump(WindPowerCurveConfig.model_json_schema(), f, indent=4)
