"""This config file contains the data for the climate events that can occur in the game."""

from datetime import timedelta

climate_events = {
    "flood": {
        "name": "Flood",
        "base_probability": 0.2,  # [probability per in-game day]
        "description": "A flood has occurred and destroyed some parts of the infrastructure. The recovery from this "
        "event will take {duration} days and cost {cost}.",
        "cost_fraction": 0.25,  # fraction of the player's industry revenue that he has to pay
        "duration": timedelta(days=8).total_seconds(),  # [in-game seconds]
        "affected_tiles": 1,
        "destruction_chance": {  # chance of destruction for each facility type
            "watermill": 0.6,
            "small_water_dam": 0.05,  # destruction affects the 3 downstream tiles
            "large_water_dam": 0.02,  # destruction affects the 15 downstream tiles
            "steam_engine": 0.05,
            "coal_burner": 0.03,
            "gas_burner": 0.03,
            "combined_cycle": 0.02,
            "nuclear_reactor": 0.01,  # not a dangerous accident but the plant has to be shut down permanently for
            # safety reasons
            "nuclear_reactor_gen4": 0.005,  # not a dangerous accident but the plant has to be shut down permanently for
            # safety reasons
        },
        "industry_destruction_chance": 0.5,  # chance of leveling down the industry
    },
    "heat_wave": {
        "name": "Heat wave",
        "base_probability": 0.35,
        "description": "A heat wave has occurred and is impacting the population. The recovery from this event will "
        "take {duration} days and cost {cost}.",
        "cost_fraction": 0.15,
        "duration": timedelta(days=4).total_seconds(),
        "affected_tiles": 2,  # (a radius of 2 so 7 tiles)
        "destruction_chance": {
            "lithium_ion_batteries": 0.05,
            "solid_state_batteries": 0.02,
        },
        "industry_destruction_chance": 0,
    },
    "cold_wave": {
        "name": "Cold wave",
        "base_probability": 0.35,
        "description": "A cold wave has occurred and is impacting the population. The recovery from this event will "
        "take {duration} days and cost {cost}.",
        "cost_fraction": 0.15,
        "duration": timedelta(days=4).total_seconds(),
        "affected_tiles": 2,  # (a radius of 2 so 7 tiles)
        "destruction_chance": {},
        "industry_destruction_chance": 0,
    },
    "hurricane": {
        "name": "Hurricane",
        "base_probability": 0.05,
        "description": "A hurricane has occurred and destroyed some parts of the infrastructure. The recovery from "
        "this event will take {duration} days and cost {cost}.",
        "cost_fraction": 0.4,
        "duration": timedelta(days=9).total_seconds(),
        "affected_tiles": 3,  # (a radius of 3 so 19 tiles)
        "destruction_chance": {
            "windmill": 0.5,
            "onshore_wind_turbine": 0.3,
            "offshore_wind_turbine": 0.2,
            "PV_solar": 0.1,
            "CSP_solar": 0.15,
        },
        "industry_destruction_chance": 0.9,
    },
    "wildfire": {
        "name": "Wildfire",
        "base_probability": 0.25,
        "description": "A wildfire has occurred and destroyed some parts of the infrastructure. The recovery from this "
        "event will take {duration} days and cost {cost}.",
        "cost_fraction": 0.3,
        "duration": timedelta(days=3).total_seconds(),
        "affected_tiles": 2,  # (a radius of 2 so 7 tiles)
        "destruction_chance": {
            "windmill": 0.1,
            "onshore_wind_turbine": 0.05,
            "watermill": 0.05,
            "steam_engine": 0.02,
            "coal_burner": 0.02,
            "gas_burner": 0.02,
            "combined_cycle": 0.02,
            "PV_solar": 0.05,
            "CSP_solar": 0.02,
        },
        "industry_destruction_chance": 0.3,
    },
}
