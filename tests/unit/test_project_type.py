from energetica.enums import (
    ControllableFacilityType,
    ExtractionFacilityType,
    Fuel,
    FunctionalFacilityType,
    HydroFacilityType,
    SolarFacilityType,
    SpecialAskType,
    StorageFacilityType,
    TechnologyType,
    WindFacilityType,
    str_to_project_type,
    str_to_project_type_extended,
)


def test_str_to_project_type():
    """Test the str_to_project_type dictionary."""
    assert str_to_project_type == {
        # Wind Facilities
        "windmill": WindFacilityType.WINDMILL,
        "onshore_wind_turbine": WindFacilityType.ONSHORE_WIND_TURBINE,
        "offshore_wind_turbine": WindFacilityType.OFFSHORE_WIND_TURBINE,
        # Hydro Facilities
        "watermill": HydroFacilityType.WATERMILL,
        "small_water_dam": HydroFacilityType.SMALL_WATER_DAM,
        "large_water_dam": HydroFacilityType.LARGE_WATER_DAM,
        # Solar Facilities
        "CSP_solar": SolarFacilityType.CSP_SOLAR,
        "PV_solar": SolarFacilityType.PV_SOLAR,
        # Controllable Facilities
        "steam_engine": ControllableFacilityType.STEAM_ENGINE,
        "coal_burner": ControllableFacilityType.COAL_BURNER,
        "gas_burner": ControllableFacilityType.GAS_BURNER,
        "combined_cycle": ControllableFacilityType.COMBINED_CYCLE,
        "nuclear_reactor": ControllableFacilityType.NUCLEAR_REACTOR,
        "nuclear_reactor_gen4": ControllableFacilityType.NUCLEAR_REACTOR_GEN4,
        # Storage Facilities
        "small_pumped_hydro": StorageFacilityType.SMALL_PUMPED_HYDRO,
        "molten_salt": StorageFacilityType.MOLTEN_SALT,
        "large_pumped_hydro": StorageFacilityType.LARGE_PUMPED_HYDRO,
        "hydrogen_storage": StorageFacilityType.HYDROGEN_STORAGE,
        "lithium_ion_batteries": StorageFacilityType.LITHIUM_ION_BATTERIES,
        "solid_state_batteries": StorageFacilityType.SOLID_STATE_BATTERIES,
        # Extraction Facilities
        "coal_mine": ExtractionFacilityType.COAL_MINE,
        "gas_drilling_site": ExtractionFacilityType.GAS_DRILLING_SITE,
        "uranium_mine": ExtractionFacilityType.URANIUM_MINE,
        # Functional Facilities
        "industry": FunctionalFacilityType.INDUSTRY,
        "laboratory": FunctionalFacilityType.LABORATORY,
        "warehouse": FunctionalFacilityType.WAREHOUSE,
        "carbon_capture": FunctionalFacilityType.CARBON_CAPTURE,
        # Technologies
        "mathematics": TechnologyType.MATHEMATICS,
        "mechanical_engineering": TechnologyType.MECHANICAL_ENGINEERING,
        "thermodynamics": TechnologyType.THERMODYNAMICS,
        "physics": TechnologyType.PHYSICS,
        "building_technology": TechnologyType.BUILDING_TECHNOLOGY,
        "mineral_extraction": TechnologyType.MINERAL_EXTRACTION,
        "transport_technology": TechnologyType.TRANSPORT_TECHNOLOGY,
        "materials": TechnologyType.MATERIALS,
        "civil_engineering": TechnologyType.CIVIL_ENGINEERING,
        "aerodynamics": TechnologyType.AERODYNAMICS,
        "chemistry": TechnologyType.CHEMISTRY,
        "nuclear_engineering": TechnologyType.NUCLEAR_ENGINEERING,
    }
    assert str_to_project_type_extended == str_to_project_type | {
        # Special Ask Prices
        "research": SpecialAskType.RESEARCH,
        "construction": SpecialAskType.CONSTRUCTION,
        "transport": SpecialAskType.TRANSPORT,
    }


# def test_subclassing():
#     for wind_facility in WindFacility:
#         assert isinstance(wind_facility, Renewable


def test_associated_fuel_and_mine():
    """Test the associated_fuel and associated_mine properties."""
    for fuel in Fuel:
        assert fuel.associated_mine.associated_fuel == fuel
    for mine in ExtractionFacilityType:
        assert mine.associated_fuel.associated_mine == mine
