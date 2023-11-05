"""
This file contains all the data needed for the game
"""

# raw data : (these are the initial values of the game)
full_config = {
    "assets": {
        "steam_engine": {
            "name": "Steam engine",
            "price": 26000,  # [CHF]
            "power generation": 210000,  # [W]
            "construction time": 3600,  # [s]
            "construction energy": 8500000,  # [Wh]
            "construction pollution": 17520,  # [kg]
            "O&M cost" : 0.8, # [fraction of price per year]
            "consumed ressource": None,
            "amount consumed": 0, # [kg/MWh]
            "efficiency" : 0.2,
            "pollution": 741,  # [kg CO2/MWh]
            "ramping time": 15,  # [min]
        },
        "windmill": {
            "name": "Windmill",
            "price": 225000,
            "power generation": 1900000,
            "construction time": 21600,
            "construction energy": 42000000,
            "construction pollution": 1600,
            "O&M cost" : 0.054,
            "consumed ressource": "wind",
            "amount consumed": 0,
            "pollution": 0,
            "ramping time": 0,
        },
        "watermill": {
            "name": "Watermill",
            "price": 222000,
            "power generation": 2700000,
            "construction time": 18000,
            "construction energy": 49500000,
            "construction pollution": 2200,
            "O&M cost" : 0.055,
            "consumed ressource": "water",
            "amount consumed": 0,
            "pollution": 0,
            "ramping time": 0,
        },
        "coal_burner": {
            "name": "Coal burner",
            "price": 533000,
            "power generation": 27000000,
            "construction time": 194400,
            "construction energy": 557000000,
            "construction pollution": 1100000,
            "O&M cost" : 0.095,
            "consumed ressource": "coal",
            "amount consumed": 480,
            "efficiency" : 0.3,
            "pollution": 1248,
            "ramping time": 75,
            "requirements": [("mechanical_engeneering", 1),
                             ("thermodynamics", 1)]
        },
        "oil_burner": {
            "name": "Oil burner",
            "price": 258000,
            "power generation": 11000000,
            "construction time": 43200,
            "construction energy": 227000000,
            "construction pollution": 440000,
            "O&M cost" : 0.1,
            "consumed ressource": "oil",
            "amount consumed": 281,
            "efficiency" : 0.27,
            "pollution": 886,
            "ramping time": 10,
            "requirements": [("mechanical_engeneering", 1),
                             ("thermodynamics", 1)]
        },
        "gas_burner": {
            "name": "Gas burner",
            "price": 465000,
            "power generation": 16000000,
            "construction time": 43200,
            "construction energy": 349000000,
            "construction pollution": 657000,
            "O&M cost" : 0.117,
            "consumed ressource": "gas",
            "amount consumed": 265,
            "efficiency" : 0.27,
            "pollution": 754,
            "ramping time": 9,
            "requirements": [("mechanical_engeneering", 1),
                             ("thermodynamics", 1)]
        },
        "small_water_dam": {
            "name": "Small water dam",
            "price": 132000,
            "power generation": 26500000,
            "construction time": 216000,
            "construction energy": 511000000,
            "construction pollution": 876000,
            "O&M cost" : 0.032,
            "consumed ressource": "hydropower",
            "amount consumed": 0,
            "pollution": 0,
            "ramping time": 0,
            "requirements": [("civil_engeneering", 1)]
        },
        "onshore_wind_turbine": {
            "name": "Wind turbine",
            "price": 4100000,
            "power generation": 11000000,
            "construction time": 64800,
            "construction energy": 679000000,
            "construction pollution": 420000,
            "O&M cost" : 0.052,
            "consumed ressource": "wind",
            "amount consumed": 0,
            "pollution": 0,
            "ramping time": 0,
            "requirements": [("aerodynamics", 1),
                             ("materials", 2),
                             ("mechanical_engeneering", 3)]
        },
        "combined_cycle": {
            "name": "Combined cycle",
            "price": 3100000,
            "power generation": 54000000,
            "construction time": 108000,
            "construction energy": 1176000000,
            "construction pollution": 1500000,
            "O&M cost" : 0.102,
            "consumed ressource": ["gas", "coal"],
            "amount consumed": [158, 57],
            "efficiency" : 0.38,
            "pollution": 598,
            "ramping time": 150,
            "requirements": [("thermodynamics", 3),
                             ("mechanical_engeneering", 3)]
        },
        "nuclear_reactor": {
            "name": "Nuclear reactor",
            "price": 8400000,
            "power generation": 167000000,
            "construction time": 432000,
            "construction energy": 2830000000,
            "construction pollution": 870000,
            "O&M cost" : 0.104,
            "consumed ressource": "uranium",
            "amount consumed": 0.033,
            "efficiency" : 0.22,
            "pollution": 2,
            "ramping time": 1200,
            "requirements": [("chemistry", 3),
                             ("nuclear_engeneering", 1)]
        },
        "large_water_dam": {
            "name": "Large water dam",
            "price": 1050000,
            "power generation": 266000000,
            "construction time": 302400,
            "construction energy": 5088000000,
            "construction pollution": 8760000,
            "O&M cost" : 0.022,
            "consumed ressource": "hydropower",
            "amount consumed": 0,
            "pollution": 0,
            "ramping time": 0,
            "requirements": [("civil_engeneering", 4)]
        },
        "CSP_solar": {
            "name": "Concentrated solar power",
            "price": 610000,
            "power generation": 19000000,
            "construction time": 129600,
            "construction energy": 525000000,
            "construction pollution": 1260000,
            "O&M cost" : 0.067,
            "consumed ressource": "irradiation",
            "amount consumed": 0,
            "pollution": 0,
            "ramping time": 0,
            "requirements": [("physics", 5),
                             ("thermodynamics", 5)]
        },
        "PV_solar": {
            "name": "Photovoltaics",
            "price": 8000000,
            "power generation": 59000000,
            "construction time": 21600,
            "construction energy": 6580000000,
            "construction pollution": 24000000,
            "O&M cost" : 0.02,
            "consumed ressource": "irradiation",
            "amount consumed": 0,
            "pollution": 0,
            "ramping time": 0,
            "requirements": [("physics", 6),
                             ("materials", 4)]
        },
        "offshore_wind_turbine": {
            "name": "Large wind turbine",
            "price": 32000000,
            "power generation": 130000000,
            "construction time": 172800,
            "construction energy": 6300000000,
            "construction pollution": 4900000,
            "O&M cost" : 0.065,
            "consumed ressource": "wind",
            "amount consumed": 0,
            "pollution": 0,
            "ramping time": 0,
            "requirements": [("aerodynamics", 3),
                             ("materials", 4),
                             ("mechanical_engeneering", 6)]
        },
        "nuclear_reactor_gen4": {
            "name": "4th generation nuclear",
            "price": 18000000,
            "power generation": 335000000,
            "construction time": 518400,
            "construction energy": 6000000000,
            "construction pollution": 2400000,
            "O&M cost" : 0.085,
            "consumed ressource": "uranium",
            "amount consumed": 0.00043,
            "efficiency" : 0.3,
            "pollution": 3,
            "ramping time": 800,
            "requirements": [("chemistry", 5),
                             ("nuclear_engeneering", 5)]
        },
        "small_pumped_hydro": {
            "name": "Small pumped hydro",
            "price": 175000,  # [CHF]
            "storage capacity": 1062000000,  # [Wh]
            "power generation": 17000000,  # [W]
            "efficiency": 0.75,
            "construction time": 187200,  # [s]
            "construction energy": 818000000,  # [Wh]
            "construction pollution": 800000,  # [kg]
            "O&M cost" : 0.088,  # [fraction of price per year]
            "ramping time": 14,  # [min]
            "requirements": [("civil_engeneering", 1)]
        },
        "compressed_air": {
            "name": "Compressed air",
            "price": 107000,
            "storage capacity": 2860000000,
            "power generation": 12000000,
            "efficiency": 0.52,
            "construction time": 64800,
            "construction energy": 638000000,
            "construction pollution": 570000,
            "O&M cost" : 0.297,
            "ramping time": 5,
            "requirements": [("mechanical_engeneering", 2),
                             ("thermodynamics", 2)]
        },
        "molten_salt": {
            "name": "Molten salt",
            "price": 275000,
            "storage capacity": 3000000000,
            "power generation": 55000000,
            "efficiency": 0.63,
            "construction time": 86400,
            "construction energy": 1370000000,
            "construction pollution": 1200000,
            "O&M cost" : 0.424,
            "ramping time": 60,
            "requirements": [("mechanical_engeneering", 2),
                             ("thermodynamics", 3)]
        },
        "large_pumped_hydro": {
            "name": "Large pumped hydro",
            "price": 1100000,
            "storage capacity": 4000000000,
            "power generation": 159000000,
            "efficiency": 0.8,
            "construction time": 334800,
            "construction energy": 3110000000,
            "construction pollution": 3000000,
            "O&M cost" : 0.115,
            "ramping time": 16,
            "requirements": [("civil_engeneering", 3)]
        },
        "hydrogen_storage": {
            "name": "Hydrogen hydrolysis",
            "price": 1600000,
            "storage capacity": 80000000000,
            "power generation": 15000000,
            "efficiency": 0.38,
            "construction time": 43200,
            "construction energy": 2570000000,
            "construction pollution": 2400000,
            "O&M cost" : 0.028,
            "ramping time": 8,
            "requirements": [("chemistry", 3),
                             ("materials", 3)]
        },
        "lithium_ion_batteries": {
            "name": "Lithium-ion batteries",
            "price": 8700000,
            "storage capacity": 3200000000,
            "power generation": 86000000,
            "efficiency": 0.69,
            "construction time": 64800,
            "construction energy": 8900000000,
            "construction pollution": 8000000,
            "O&M cost" : 0.003,
            "ramping time": 3,
            "requirements": [("chemistry", 4),
                             ("materials", 4)]
        },
        "solid_state_batteries": {
            "name": "Solid state batteries",
            "price": 14000000,
            "storage capacity": 5000000000,
            "power generation": 107000000,
            "efficiency": 0.79,
            "construction time": 54000,
            "construction energy": 10000000000,
            "construction pollution": 6000000,
            "O&M cost" : 0.002,
            "ramping time": 3,
            "requirements": [("chemistry", 6),
                             ("materials", 5),
                             ("physics", 6)]
        },
        "laboratory": {
            "name": "Laboratory",
            "price": 1000000,  # [CHF]
            "construction time": 10800,  # [s]
            "construction energy": 1000000000,  # [Wh]
            "construction pollution": 100000,  # [kg]
        },
        "warehouse": {
            "name": "Warehouse",
            "price": 500000,
            "construction time": 18000,
            "construction energy": 10000,
            "construction pollution": 25000,
        },
        "industry": {
            "name": "Industry",
            "price": 10000,
            "construction time": 1800,
            "construction energy": 10000000,
            "construction pollution": 1000,
        },
        "carbon_capture": {
            "name": "Carbon capture",
            "price": 2500000,
            "construction time": 36000,
            "construction energy": 5000000000,
            "construction pollution": 250000,
        },
        "coal_mine": {
            "name": "Coal mine",
            "price": 285000,  # [CHF]
            "construction time": 28800,  # [s]
            "construction energy": 126000000,  # [Wh]
            "construction pollution": 200000,  # [kg]
            "O&M cost" : 0.25, # [fraction of price per year]
            "amount produced": 0.0000006,  # [fraction of total stock that can be extracted every minute by one mine]
            "power consumption": 1800000,  # [W]
            "pollution": 65,  # [kg/t extracted]
            "requirements": [("mineral_extraction", 1)]
        },
        "oil_field": {
            "name": "Oil field",
            "price": 370000,
            "construction time": 54000,
            "construction energy": 230000000,
            "construction pollution": 400000,
            "O&M cost" : 0.26,
            "amount produced": 0.000001,
            "power consumption": 1530000,
            "pollution": 302,
            "requirements": [("mineral_extraction", 3)]
        },
        "gas_drilling_site": {
            "name": "Gas drilling site",
            "price": 335000,
            "construction time": 54000,
            "construction energy": 250000000,
            "construction pollution": 700000,
            "O&M cost" : 0.26,
            "amount produced": 0.0000008,
            "power consumption": 1110000,
            "pollution": 523,
            "requirements": [("mineral_extraction", 3)]
        },
        "uranium_mine": {
            "name": "Uranium mine",
            "price": 1040000,
            "construction time": 86400,
            "construction energy": 540000000,
            "construction pollution": 500000,
            "O&M cost" : 0.5,
            "amount produced": 0.0000004,
            "power consumption": 3600000,
            "pollution": 230000,
            "requirements": [("mineral_extraction", 5)]
        },
        "mathematics": {
            "name": "Mathematics",
            "price": 1800000,  # [CHF]
            "price multiplier": 1.3,
            "construction time": 18000,  # [s]
            "construction energy": 25000000,  # [Wh]
            "requirements": [("laboratory", 0)] # level is given relative to the research level 
        },
        "mechanical_engeneering": {
            "name": "Mechanical engeneering",
            "price": 1800000,
            "price multiplier": 1.3,
            "construction time": 18000,
            "construction energy": 25000000,
            "price factor": 1.2,
            "prod factor" : 1.25,
            "requirements": [("laboratory", 1),
                             ("mathematics", 0)]
        },
        "thermodynamics": {
            "name": "Thermodynamics",
            "price": 1800000,
            "price multiplier": 1.3,
            "construction time": 18000,
            "construction energy": 25000000,
            "prod factor" : 1.25,
            "efficiency factor" : 0.05,
            "requirements": [("laboratory", 1),
                             ("mathematics", 0)]
        },
        "physics": {
            "name": "Physics",
            "price": 1800000,
            "price multiplier": 1.3,
            "construction time": 18000,
            "construction energy": 25000000,
            "price factor": 1.2,
            "prod factor" : 1.25,
            "requirements": [("laboratory", 1),
                             ("mathematics", 0),
                             ("chemistry", -2)]
        },
        "building_technology": {
            "name": "Building Technology",
            "price": 2800000,
            "price multiplier": 1.3,
            "construction time": 28800,
            "construction energy": 80000000,
            "time factor": 0.85,
            "requirements": [("laboratory", 1),
                             ("mechanical_engeneering", 0),
                             ("transport_technology", -2)]
        },
        "mineral_extraction": {
            "name": "Mineral extraction",
            "price": 1600000, 
            "price multiplier": 1.4,
            "construction time": 14400, 
            "construction energy": 40000000,
            "price factor": 1.25,
            "prod factor" : 1.33,
            "energy factor": 1.28,
            "pollution factor": 0.9,
            "requirements": [("laboratory", 2),
                             ("building_technology", 0)]
        },
        "transport_technology": {
            "name": "Transport technology",
            "price": 2800000,
            "price multiplier": 1.4,
            "construction time": 28800,
            "construction energy": 120000000,
            "time factor": 0.85,
            "energy factor": 0.9,
            "requirements": [("laboratory", 2),
                             ("mathematics", 1),
                             ("mechanical_engeneering", 1)]
        },
        "materials": {
            "name": "Materials",
            "price": 4200000,
            "price multiplier": 1.4,
            "construction time": 43200,
            "construction energy": 240000000,
            "price factor": 0.8,
            "requirements": [("laboratory", 2),
                             ("mathematics", 1),
                             ("chemistry", 0)]
        },
        "civil_engeneering": {
            "name": "Civil engeneering",
            "price": 1400000,
            "price multiplier": 1.5,
            "construction time": 14400,
            "construction energy": 80000000,
            "price factor": 1.5,
            "prod factor" : 1.4,
            "capacity factor": 1.4,
            "requirements": [("laboratory", 3),
                             ("mathematics", 1),
                             ("building_technology", 2)]
        },
        "aerodynamics": {
            "name": "Aerodynamics",
            "price": 4200000,
            "price multiplier": 1.5,
            "construction time": 43200,
            "construction energy": 300000000,
            "price factor": 1.3,
            "prod factor" : 1.4,
            "requirements": [("laboratory", 3),
                             ("physics", 2),
                             ("building_technology", 2)]
        },
        "chemistry": {
            "name": "Chemistry",
            "price": 3000000,
            "price multiplier": 1.4,
            "construction time": 28800,
            "construction energy": 200000000,
            "price factor": 1.25,
            "efficiency factor" : 0.9,
            "requirements": [("laboratory", 3),
                             ("physics", -1),
                             ("mathematics", 1)]
        },
        "nuclear_engeneering": {
            "name": "Nuclear Engeneering",
            "price": 7000000,
            "price multiplier": 1.5,
            "construction time": 64800,
            "construction energy": 540000000,
            "price factor": 1.3,
            "prod factor" : 1.4,
            "requirements": [("laboratory", 4),
                             ("physics", 2),
                             ("building_technology", 2),
                             ("mechanical_engeneering", 2)]
        },
    },
    "warehouse_capacities":{
        "coal": 3000000, #[kg]
        "oil":   300000,
        "gas":  1000000,
        "uranium": 5000,
    },
    "transport_speed": 5000 #[s/distance unit]
}

wind_power_curve = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0.0013449, 0.00821, 0.015678, 0.024249, 0.034402, 0.046221, 0.059494, 0.074, 0.089609, 0.10656,
            0.12518, 0.14581, 0.16863, 0.19365, 0.22089, 0.25034, 0.28197, 0.31575, 0.35165, 0.38968,
            0.43003, 0.4729, 0.51844, 0.56601, 0.61438, 0.6623, 0.70858, 0.75233, 0.79272, 0.82894,
            0.86076, 0.88869, 0.91332, 0.93514, 0.95407, 0.96978, 0.98193, 0.99048, 0.99602, 0.99922,
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.8, 0.6, 0.4, 0.2, 0] # from 0 to 100 km/h

river_discharge = [0.26, 0.23, 0.3, 0.5, 0.85, 1, 0.96, 0.85, 0.55, 0.4, 0.35, 0.3] # from january to december

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
        for asset in assets:
            if "ramping time" in assets[asset]:
                if assets[asset]["ramping time"] == 0:
                    assets[asset]["ramping speed"] = 0
                else: 
                    assets[asset]["ramping speed"] = assets[asset]["power generation"]/assets[asset]["ramping time"]

        max_cap = config.for_player[player_id]["warehouse_capacities"]
        for ressource in max_cap:
            max_cap[ressource] *= pow(1.5, player.warehouse)

        config.for_player[player_id]["transport_speed"] *= pow(0.85, player.transport_technology)

    def __getitem__(config, player_id):
        if player_id not in config.for_player:
            config.update_config_for_user(player_id)
        return config.for_player[player_id]


config = Config()
