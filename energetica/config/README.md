# Configuration for Game Values

## Config Files

Game values are stored in configuration files as YAML. These can be found in the
`config/` directory. The files contained are structured named as follows:

-   `config/power-facilities.yaml`
-   `config/storage-facilities.yaml`
-   `config/extraction-facilities.yaml`
-   `config/functional-facilities.yaml`
-   `config/technologies.yaml`

## Config Models

The YAML files are loaded into memory at startup, when the main `GameEngine`
object is initialised. These conform to pydantic models, which are located in
the `energetica/config/` module.

These models are used to validate that the YAML config files are correctly
structured. This includes verifying that values are non-negative, or that some
multipliers are in the interval of zero to one exclusive, for example.

The validation rules are also exported to JSON schemas. The
`save_config_schemas.py` is responsible for generating these JSON schemas.
These are used by the `redhat.vscode-yaml` extension within VSCode to give IDE
validation. The JSON schemas are exported to the `energetica/schemas/config`
directory.

### Config Models Hierarchy

```mermaid
classDiagram
    class BaseFacilityConfig:::abstract {
        +str name
        +str description
        +str wikipedia_link
        +int base_price
        +dict requirements
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
    class PowerFacilityConfig:::final {
        +dict consumed_resources
    }
    class StorageFacilityConfig:::final {
        +float base_storage_capacity
        +float base_efficiency
        +float initial_efficiency
    }
    class ExtractionFacilityConfig:::final {
        +float base_power_consumption
        +float base_pollution
        +float base_extraction_rate_per_day
    }
    class FunctionalFacilityConfig:::final {
        various
    }
    class TechnologyConfig:::final {
        +list affected_facilities
        various
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

<!-- classDef final stroke:#cc,stroke-width:3px,stroke-dasharray: 5 2; -->
