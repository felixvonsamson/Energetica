"""
This file contains all the data needed for the game
"""

# raw data :
full_config = {
    "assets": {
        "steam_engine": {
            "name": "Steam engine",
            "price": 200,  # [CHF]
            "power generation": 25000,  # [W]
            "construction time": 10,  # [s]
            "construction energy": 10000,  # [Wh]
            "construction pollution": 12000,  # [kg]
            "consumed ressource": "money",
            "amount consumed": 100, # [kg/h]
            "pollution": 494,  # [kg CO2/h]
            "ramping speed": 1800,  # [W/min] (13.8 min)
        },
        "windmill": {
            "name": "Windmill",
            "price": 15000,
            "power generation": 3000,
            "construction time": 18000,
            "construction energy": 3000,
            "construction pollution": 12000,
            "consumed ressource": "wind",
            "amount consumed": 0,
            "pollution": 0,
            "ramping speed": 0,
        },
        "watermill": {
            "name": "Watermill",
            "price": 50000,
            "power generation": 10000,
            "construction time": 36000,
            "construction energy": 5000,
            "construction pollution": 12000,
            "consumed ressource": "water",
            "amount consumed": 0,
            "pollution": 0,
            "ramping speed": 0,
        },
        "coal_burner": {
            "name": "Coal burner",
            "price": 500,
            "power generation": 120000,
            "construction time": 17,
            "construction energy": 17280,
            "construction pollution": 12000,
            "consumed ressource": "coal",
            "amount consumed": 60000,
            "pollution": 986,
            "ramping speed": 650000, #(184.6 min)
        },
        "oil_burner": {
            "name": "Oil burner",
            "price": 5000000,
            "power generation": 80000000,
            "construction time": 172800,
            "construction energy": 17280,
            "construction pollution": 12000,
            "consumed ressource": "oil",
            "amount consumed": 21818,
            "pollution": 777,
            "ramping speed": 800000, #(100 min)
        },
        "gas_burner": {
            "name": "Gas burner",
            "price": 5000000,
            "power generation": 100000000,
            "construction time": 172800,
            "construction energy": 17280,
            "construction pollution": 12000,
            "consumed ressource": "gas",
            "amount consumed": 21818,
            "pollution": 429,
            "ramping speed": 3600000, #(27.8 min)
        },
        "shallow_geothermal_plant": {
            "name": "Shallow geothermal plant",
            "price": 1000000,
            "power generation": 350000,
            "construction time": 172800,
            "construction energy": 17280,
            "construction pollution": 12000,
            "consumed ressource": "geothermy",
            "amount consumed": 0,
            "pollution": 6,
            "ramping speed": 0,
        },
        "small_water_dam": {
            "name": "Small water dam",
            "price": 400000000,
            "power generation": 200000000,
            "construction time": 172800,
            "construction energy": 17280,
            "construction pollution": 12000,
            "consumed ressource": "hydropower",
            "amount consumed": 0,
            "pollution": 0,
            "ramping speed": 0,
        },
        "wind_turbine": {
            "name": "Wind turbine",
            "price": 2000000,
            "power generation": 500000,
            "construction time": 172800,
            "construction energy": 17280,
            "construction pollution": 12000,
            "consumed ressource": "wind",
            "amount consumed": 0,
            "pollution": 0,
            "ramping speed": 0,
        },
        "combined_cycle": {
            "name": "Combined cycle",
            "price": 300000000,
            "power generation": 530000000,
            "construction time": 172800,
            "construction energy": 17280,
            "construction pollution": 12000,
            "consumed ressource": ["gas", "coal"],
            "amount consumed": [60000, 9000],
            "pollution": 488,
            "ramping speed": 7200000, #(73.6 min)
        },
        "deep_geothermal_plant": {
            "name": "Deep geothermal plant",
            "price": 250000000,
            "power generation": 120000000,
            "construction time": 172800,
            "construction energy": 17280,
            "construction pollution": 12000,
            "consumed ressource": "geothermy",
            "amount consumed": 0,
            "pollution": 10,
            "ramping speed": 0,
        },
        "nuclear_reactor": {
            "name": "Nuclear reactor",
            "price": 1000000000,
            "power generation": 900000,
            "construction time": 172800,
            "construction energy": 17280,
            "construction pollution": 12000,
            "consumed ressource": "uranium",
            "amount consumed": 360,
            "pollution": 2,
            "ramping speed": 10000, #(15 h)
        },
        "large_water_dam": {
            "name": "Large water dam",
            "price": 2000000000,
            "power generation": 1200000000,
            "construction time": 172800,
            "construction energy": 17280,
            "construction pollution": 12000,
            "consumed ressource": "hydropower",
            "amount consumed": 0,
            "pollution": 0,
            "ramping speed": 0,
        },
        "CSP_solar": {
            "name": "Concentrated solar power",
            "price": 800000000,
            "power generation": 400000,
            "construction time": 172800,
            "construction energy": 17280,
            "construction pollution": 12000,
            "consumed ressource": "irradiation",
            "amount consumed": 0,
            "pollution": 0,
            "ramping speed": 0,
        },
        "PV_solar": {
            "name": "Photovoltaics",
            "price": 1200,
            "power generation": 900,
            "construction time": 172800,
            "construction energy": 17280,
            "construction pollution": 12000,
            "consumed ressource": "irradiation",
            "amount consumed": 0,
            "pollution": 0,
            "ramping speed": 0,
        },
        "large_wind_turbine": {
            "name": "Large wind turbine",
            "price": 7000000,
            "power generation": 2500000,
            "construction time": 172800,
            "construction energy": 17280,
            "construction pollution": 12000,
            "consumed ressource": "wind",
            "amount consumed": 0,
            "pollution": 0,
            "ramping speed": 0,
        },
        "nuclear_reactor_gen4": {
            "name": "4th generation nuclear",
            "price": 9000000000,
            "power generation": 2500000000,
            "construction time": 172800,
            "construction energy": 17280,
            "construction pollution": 12000,
            "consumed ressource": "uranium",
            "amount consumed": 3,
            "pollution": 2,
            "ramping speed": 2000000, #(20.8 h)
        },
        "small_pumped_hydro": {
            "name": "Small pumped hydro",
            "price": 400000000,  # [CHF]
            "storage capacity": 3000000000,  # [Wh]
            "power generation": 550000,  # [W]
            "efficiency": 0.75,
            "construction time": 36000,  # [s]
            "construction energy": 10000,  # [Wh]
            "construction pollution": 12000,  # [kg]
            "ramping speed": 11000000,  # [W/min] (5 min)
        },
        "compressed_air": {
            "name": "Compressed air",
            "price": 1200000000,
            "storage capacity": 100000000,
            "power generation": 200000,
            "efficiency": 0.60,
            "construction time": 36000,
            "construction energy": 10000,
            "construction pollution": 12000,
            "ramping speed": 10000000, #(2 min) 
        },
        "molten_salt": {
            "name": "Molten salt",
            "price": 30000000,
            "storage capacity": 600000000,
            "power generation": 240000000,
            "efficiency": 0.92,
            "construction time": 36000,
            "construction energy": 10000,
            "construction pollution": 12000,
            "ramping speed": 4000000, #(60 min)
        },
        "large_pumped_hydro": {
            "name": "Large pumped hydro",
            "price": 1300000000,
            "storage capacity": 16000000000,
            "power generation": 400000000,
            "efficiency": 0.8,
            "construction time": 36000,
            "construction energy": 10000,
            "construction pollution": 12000,
            "ramping speed": 40000000, #(10 min)
        },
        "hydrogen_storage": {
            "name": "Hydrogen hydrolysis",
            "price": 7000000,
            "storage capacity": 80000000000000,
            "power generation": 750000000,
            "efficiency": 0.4,
            "construction time": 36000,
            "construction energy": 10000,
            "construction pollution": 12000,
            "ramping speed": 250000000, #(3 min)
        },
        "lithium_ion_batteries": {
            "name": "Lithium-ion batteries",
            "price": 150000000,
            "storage capacity": 100000000,
            "power generation": 20000000,
            "efficiency": 0.98,
            "construction time": 36000,
            "construction energy": 10000,
            "construction pollution": 12000,
            "ramping speed": 20000000, #(1 min)
        },
        "solid_state_batteries": {
            "name": "Solid state batteries",
            "price": 350000000,
            "storage capacity": 140000000,
            "power generation": 30000000,
            "efficiency": 0.99,
            "construction time": 36000,
            "construction energy": 10000,
            "construction pollution": 12000,
            "ramping speed": 30000000, #(1 min)
        },
        "laboratory": {
            "name": "Laboratory",
            "price": 2500000,  # [CHF]
            "construction time": 36000,  # [s]
            "construction energy": 10000,  # [Wh]
            "construction pollution": 12000,  # [kg]
        },
        "warehouse": {
            "name": "Warehouse",
            "price": 400000,
            "construction time": 36000,
            "construction energy": 10000,
            "construction pollution": 12000,
        },
        "industry": {
            "name": "Industry",
            "price": 5000,
            "construction time": 36000,
            "construction energy": 10000,
            "construction pollution": 12000,
        },
        "military_barracks": {
            "name": "Military barracks",
            "price": 80000000,
            "construction time": 36000,
            "construction energy": 10000,
            "construction pollution": 12000,
        },
        "coal_mine": {
            "name": "Coal mine",
            "price": 2500,  # [CHF]
            "construction time": 3,  # [s]
            "construction energy": 10000,  # [Wh]
            "construction pollution": 12000,  # [kg]
            "amount produced": 0.000003,  # [fraction of total stock that can be extracted every minute by one mine]
            "power consumption": 3000,  # [W]
            "pollution": 2,  # [kg/h]
        },
        "oil_field": {
            "name": "Oil field",
            "price": 2500000,
            "construction time": 36000,
            "construction energy": 10000,
            "construction pollution": 12000,
            "amount produced": 0.000005,
            "power consumption": 3000,
            "pollution": 2,
        },
        "gas_drilling_site": {
            "name": "Gas drilling site",
            "price": 2500000,
            "construction time": 36000,
            "construction energy": 10000,
            "construction pollution": 12000,
            "amount produced": 0.000004,
            "power consumption": 3000,
            "pollution": 2,
        },
        "uranium_mine": {
            "name": "Uranium mine",
            "price": 2500000,
            "construction time": 36000,
            "construction energy": 10000,
            "construction pollution": 12000,
            "amount produced": 0.000002,
            "power consumption": 3000,
            "pollution": 2,
        },
        "mineral_extraction": {
            "name": "Mineral extraction",
            "price": 40000,  # [CHF]
            "price multiplier": 1.3,
            "construction time": 36000,  # [s]
            "construction energy": 10000,  # [Wh]
        },
        "civil_engeneering": {
            "name": "Civil engeneering",
            "price": 40000,
            "price multiplier": 1.3,
            "construction time": 36000,
            "construction energy": 10000,
        },
        "mechanical_engeneering": {
            "name": "Mechanical engeneering",
            "price": 40000,
            "price multiplier": 1.3,
            "construction time": 36000,
            "construction energy": 10000,
        },
        "physics": {
            "name": "Physics",
            "price": 40000,
            "price multiplier": 1.3,
            "construction time": 36000,
            "construction energy": 10000,
        },
        "materials": {
            "name": "Materials",
            "price": 40000,
            "price multiplier": 1.3,
            "construction time": 36000,
            "construction energy": 10000,
        },
        "carbon_capture": {
            "name": "Carbon capture",
            "price": 40000,
            "price multiplier": 1.3,
            "construction time": 36000,
            "construction energy": 10000,
        },
        "transport_technology": {
            "name": "Transport technology",
            "price": 40000,
            "price multiplier": 1.3,
            "construction time": 36000,
            "construction energy": 10000,
        },
        "aerodynamics": {
            "name": "Aerodynamics",
            "price": 40000,
            "price multiplier": 1.3,
            "construction time": 36000,
            "construction energy": 10000,
        },
        "geology": {
            "name": "Geology",
            "price": 40000,
            "price multiplier": 1.3,
            "construction time": 36000,
            "construction energy": 10000,
        },
    },
    "warehouse_capacities":{
        "coal": 1000000, #[kg]
        "oil": 1000000,
        "gas": 1000000,
        "uranium": 15000,
    }
}

from .database import Player

# config object that contains the modified data for a specific player considering the technologies he owns :
class Config(object):
    def __init__(config):
        config.for_player = {}

    def update_config_for_user(config, player_id):
        config.for_player[player_id] = full_config.copy()
        assets = config.for_player[player_id]["assets"]
        player = Player.query.get(player_id)
        assets["coal_mine"]["amount produced"] = full_config["assets"]["coal_mine"]["amount produced"] * player.tile[0].coal * 100000000
        assets["oil_field"]["amount produced"] = full_config["assets"]["oil_field"]["amount produced"] * player.tile[0].oil  * 100000000
        assets["gas_drilling_site"]["amount produced"] = full_config["assets"]["gas_drilling_site"]["amount produced"] * player.tile[0].gas * 100000000
        assets["uranium_mine"]["amount produced"] = full_config["assets"]["uranium_mine"]["amount produced"] * player.tile[0].uranium * 10000000

        max_cap = config.for_player[player_id]["warehouse_capacities"]
        for ressource in max_cap:
            max_cap[ressource] = max_cap[ressource]*pow(1.5,player.warehouse)

    def __getitem__(config, player_id):
        if player_id not in config.for_player:
            config.update_config_for_user(player_id)
        return config.for_player[player_id]


config = Config()
