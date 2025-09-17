""""""

import json

from energetica.schemas.config.extraction_facility import ExtractionFacilitiesConfig
from energetica.schemas.config.functional_facility import FunctionalFacilitiesConfig
from energetica.schemas.config.power_facility import PowerFacilitiesConfig
from energetica.schemas.config.seasonal_river_discharge import SeasonalRiverDischargeConfig
from energetica.schemas.config.storage_facility import StorageFacilitiesConfig
from energetica.schemas.config.technology import TechnologiesConfig
from energetica.schemas.config.wind_power_curve import WindPowerCurveConfig


with open("./config-schemas/power-facilities-schema.json", "w") as f:
    json.dump(PowerFacilitiesConfig.model_json_schema(), f, indent=4)

with open("./config-schemas/storage-facilities-schema.json", "w") as f:
    json.dump(StorageFacilitiesConfig.model_json_schema(), f, indent=4)

with open("./config-schemas/extraction-facilities-schema.json", "w") as f:
    json.dump(ExtractionFacilitiesConfig.model_json_schema(), f, indent=4)

with open("./config-schemas/functional-facilities-schema.json", "w") as f:
    json.dump(FunctionalFacilitiesConfig.model_json_schema(), f, indent=4)

with open("./config-schemas/technologies-schema.json", "w") as f:
    json.dump(TechnologiesConfig.model_json_schema(), f, indent=4)

with open("./config-schemas/seasonal-river-discharge-schema.json", "w") as f:
    json.dump(SeasonalRiverDischargeConfig.model_json_schema(), f, indent=4)

with open("./config-schemas/wind-power-curve-schema.json", "w") as f:
    json.dump(WindPowerCurveConfig.model_json_schema(), f, indent=4)
