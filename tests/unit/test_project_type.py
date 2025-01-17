from energetica.enums import (
    ControllableFacility,
    ExtractionFacility,
    FunctionalFacility,
    HydroFacility,
    SolarFacility,
    SpecialAsk,
    StorageFacility,
    Technology,
    WindFacility,
    str_to_project_name,
)


def test_str_to_project_name():
    """Test the str_to_project_name dictionary."""
    assert str_to_project_name == {
        # Wind Facilities
        "windmill": WindFacility.WINDMILL,
        "onshore_wind_turbine": WindFacility.ONSHORE_WIND_TURBINE,
        "offshore_wind_turbine": WindFacility.OFFSHORE_WIND_TURBINE,
        # Hydro Facilities
        "watermill": HydroFacility.WATERMILL,
        "small_water_dam": HydroFacility.SMALL_WATER_DAM,
        "large_water_dam": HydroFacility.LARGE_WATER_DAM,
        # Solar Facilities
        "CSP_solar": SolarFacility.CSP_SOLAR,
        "PV_solar": SolarFacility.PV_SOLAR,
        # Controllable Facilities
        "steam_engine": ControllableFacility.STEAM_ENGINE,
        "coal_burner": ControllableFacility.COAL_BURNER,
        "gas_burner": ControllableFacility.GAS_BURNER,
        "combined_cycle": ControllableFacility.COMBINED_CYCLE,
        "nuclear_reactor": ControllableFacility.NUCLEAR_REACTOR,
        "nuclear_reactor_gen4": ControllableFacility.NUCLEAR_REACTOR_GEN4,
        # Storage Facilities
        "small_pumped_hydro": StorageFacility.SMALL_PUMPED_HYDRO,
        "molten_salt": StorageFacility.MOLTEN_SALT,
        "large_pumped_hydro": StorageFacility.LARGE_PUMPED_HYDRO,
        "hydrogen_storage": StorageFacility.HYDROGEN_STORAGE,
        "lithium_ion_batteries": StorageFacility.LITHIUM_ION_BATTERIES,
        "solid_state_batteries": StorageFacility.SOLID_STATE_BATTERIES,
        # Extraction Facilities
        "coal_mine": ExtractionFacility.COAL_MINE,
        "gas_drilling_site": ExtractionFacility.GAS_DRILLING_SITE,
        "uranium_mine": ExtractionFacility.URANIUM_MINE,
        # Functional Facilities
        "industry": FunctionalFacility.INDUSTRY,
        "laboratory": FunctionalFacility.LABORATORY,
        "warehouse": FunctionalFacility.WAREHOUSE,
        "carbon_capture": FunctionalFacility.CARBON_CAPTURE,
        # Technologies
        "mathematics": Technology.MATHEMATICS,
        "mechanical_engineering": Technology.MECHANICAL_ENGINEERING,
        "thermodynamics": Technology.THERMODYNAMICS,
        "physics": Technology.PHYSICS,
        "building_technology": Technology.BUILDING_TECHNOLOGY,
        "mineral_extraction": Technology.MINERAL_EXTRACTION,
        "transport_technology": Technology.TRANSPORT_TECHNOLOGY,
        "materials": Technology.MATERIALS,
        "civil_engineering": Technology.CIVIL_ENGINEERING,
        "aerodynamics": Technology.AERODYNAMICS,
        "chemistry": Technology.CHEMISTRY,
        "nuclear_engineering": Technology.NUCLEAR_ENGINEERING,
        # Special Ask Prices
        "research": SpecialAsk.RESEARCH,
        "construction": SpecialAsk.CONSTRUCTION,
        "transport": SpecialAsk.TRANSPORT,
    }


# def test_subclassing():
#     for wind_facility in WindFacility:
#         assert isinstance(wind_facility, Renewable
