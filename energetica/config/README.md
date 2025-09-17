# Configuration for Game Values

## Config Files

Game values are stored in configuration files as JSON and YAML. These can be
found in the `config/` directory. The config files are loaded into memory at
startup, when the main `GameEngine` object is initialised.

The files contained are structured named as follows:

-   `config/power-facilities.yaml`
-   `config/storage-facilities.yaml`
-   `config/extraction-facilities.yaml`
-   `config/functional-facilities.yaml`
-   `config/technologies.yaml`
-   `config/seasonal-river-discharge.json`
-   `config/wind-power-curve.json`

## Pydantic Models

The pydantic models are located in the `energetica/schemas/config/` module.
These ensure correct validation of the config files on startup.
For example, verifying that values are non-negative, or that appropriate
multipliers are in specific numeric intervals.

## IDE Validation

The validation rules are also exported to JSON schemas. The
`./save_config_schemas.py` module is responsible for generating these.
The `redhat.vscode-yaml` extension for VSCode can then offer in IDE validation.
The JSON schemas are exported to the `./config-schemas` directory.

### Hierarchy for Project Models

below, concrete models have a solid border, abstract models have a dashed border.

```mermaid
classDiagram
    class BaseFacilityConfig:::abstract {
        +str name
        +str description
        +str wikipedia_link
        +int base_price
        +float base_construction_time
        +float base_construction_pollution
        +dict requirements
    }
    class OperatingFacilityConfig:::abstract {
        +float lifespan
        +float o_and_m_factor_per_day
        +float construction_power_factor
    }
    class PowerProducingFacilityConfig:::abstract {
        +float base_power_generation
        +float ramping_time
    }
    class LevelProjectConfig:::abstract {
        +float base_construction_energy
        +float price_multiplier
    }
    class PowerFacilityConfig:::concrete {
        +dict consumed_resources
        +float base_pollution
    }
    class StorageFacilityConfig:::concrete {
        +float base_storage_capacity
        +float base_efficiency
    }
    class ExtractionFacilityConfig:::concrete {
        +float base_power_consumption
        +float base_pollution
        +float base_extraction_rate_per_day
    }
    class FunctionalFacilityConfig:::abstract {
        ...
    }
    class TechnologyConfig:::abstract {
        +list affected_facilities
        ...
    }
    BaseFacilityConfig <|-- OperatingFacilityConfig
    OperatingFacilityConfig <|-- PowerProducingFacilityConfig
    PowerProducingFacilityConfig <|-- PowerFacilityConfig
    PowerProducingFacilityConfig <|-- StorageFacilityConfig
    OperatingFacilityConfig <|-- ExtractionFacilityConfig
    BaseFacilityConfig <|-- LevelProjectConfig
    LevelProjectConfig <|-- FunctionalFacilityConfig
    LevelProjectConfig <|-- TechnologyConfig
    classDef abstract stroke:#cc,stroke-dasharray: 5 5;
```
