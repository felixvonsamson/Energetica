# Configuration for game entities

## Loading Configuration

Configuration files are saved as YAML files, loaded from the `config/` top level
directory, and are named as follows:

-   `power-facilities.yaml`: Configuration for power-producing facilities.
-   `storage-facilities.yaml`: Configuration for storage facilities.
-   `extraction-facilities.yaml`: Configuration for resource extraction facilities.
-   `functional-facilities.yaml`: Configuration for functional facilities.
-   `technologies.yaml`: Configuration for technologies.

The Pydantic models defining the schema for theses YAML files are defined in the
`energetica/config/` modules.

## Configuration Models

Each configuration file is represented by a Pydantic model in the
`energetica/config` module. They are structured according to the following
hierarchy:

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
