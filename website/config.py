"""
This file contains all the data needed for the game
"""

# raw data : (these are the initial values of the game)
full_config = {
    "assets": {
        "steam_engine": {
            "name": "Steam engine",
            "price": 2600,  # [¤]
            "power generation": 210000,  # [W]
            "construction time": 3600,  # [s]
            "construction power factor": 0.4,  # fraction of power gen during construction
            "construction pollution": 17520,  # [kg]
            "O&M cost" : 0.8, # [fraction of price per (day)]
            "consumed ressource": None,
            "amount consumed": 0, # [kg/MWh]
            "pollution": 988,  # [kg CO2/MWh]
            "ramping time": 15,  # [min]
            "requirements": [],
        },
        "windmill": {
            "name": "Windmill",
            "price": 22200,
            "power generation": 3350000,
            "construction time": 21600,
            "construction power factor": 0.7,
            "construction pollution": 1600,
            "O&M cost" : 0.054,
            "consumed ressource": "wind",
            "amount consumed": 0,
            "pollution": 0,
            "ramping time": 0,
            "requirements": [],
        },
        "watermill": {
            "name": "Watermill",
            "price": 15000,
            "power generation": 2700000,
            "construction time": 18000,
            "construction power factor": 0.6,
            "construction pollution": 2200,
            "O&M cost" : 0.055,
            "consumed ressource": "water",
            "amount consumed": 0,
            "pollution": 0,
            "ramping time": 0,
            "requirements": [],
        },
        "coal_burner": {
            "name": "Coal burner",
            "price": 53300,
            "power generation": 27000000,
            "construction time": 194400,
            "construction power factor": 0.5,
            "construction pollution": 1100000,
            "O&M cost" : 0.095,
            "consumed ressource": "coal",
            "amount consumed": 640,
            "pollution": 1664,
            "ramping time": 75,
            "requirements": [["mechanical_engineering", 1, False],
                             ["thermodynamics", 1, False]]
        },
        "oil_burner": {
            "name": "Oil burner",
            "price": 25800,
            "power generation": 11000000,
            "construction time": 43200,
            "construction power factor": 1.1,
            "construction pollution": 440000,
            "O&M cost" : 0.1,
            "consumed ressource": "oil",
            "amount consumed": 375,
            "pollution": 1181,
            "ramping time": 10,
            "requirements": [["mechanical_engineering", 1, False],
                             ["thermodynamics", 1, False]]
        },
        "gas_burner": {
            "name": "Gas burner",
            "price": 46500,
            "power generation": 16000000,
            "construction time": 43200,
            "construction power factor": 1.1,
            "construction pollution": 657000,
            "O&M cost" : 0.117,
            "consumed ressource": "gas",
            "amount consumed": 353,
            "pollution": 1006,
            "ramping time": 9,
            "requirements": [["mechanical_engineering", 1, False],
                             ["thermodynamics", 1, False]]
        },
        "small_water_dam": {
            "name": "Small water dam",
            "price": 20000,
            "power generation": 41500000,
            "construction time": 216000,
            "construction power factor": 0.2,
            "construction pollution": 876000,
            "O&M cost" : 0.032,
            "consumed ressource": "hydropower",
            "amount consumed": 0,
            "pollution": 0,
            "ramping time": 0,
            "requirements": [["civil_engineering", 1, False]]
        },
        "onshore_wind_turbine": {
            "name": "Onshore wind turbine",
            "price": 410000,
            "power generation": 11000000,
            "construction time": 64800,
            "construction power factor": 1.7,
            "construction pollution": 420000,
            "O&M cost" : 0.052,
            "consumed ressource": "wind",
            "amount consumed": 0,
            "pollution": 0,
            "ramping time": 0,
            "requirements": [["aerodynamics", 1, False],
                             ["materials", 2, False],
                             ["mechanical_engineering", 3, False]]
        },
        "combined_cycle": {
            "name": "Combined cycle",
            "price": 310000,
            "power generation": 54000000,
            "construction time": 108000,
            "construction power factor": 0.7,
            "construction pollution": 1500000,
            "O&M cost" : 0.102,
            "consumed ressource": ["gas", "coal"],
            "amount consumed": [210, 76],
            "pollution": 797,
            "ramping time": 150,
            "requirements": [["thermodynamics", 3, False],
                             ["mechanical_engineering", 3, False]]
        },
        "nuclear_reactor": {
            "name": "Nuclear reactor",
            "price": 840000,
            "power generation": 167000000,
            "construction time": 432000,
            "construction power factor": 0.1,
            "construction pollution": 870000,
            "O&M cost" : 0.104,
            "consumed ressource": "uranium",
            "amount consumed": 0.044,
            "efficiency" : 0.22,
            "pollution": 2,
            "ramping time": 1200,
            "requirements": [["chemistry", 3, False],
                             ["nuclear_engineering", 1, False]]
        },
        "large_water_dam": {
            "name": "Large water dam",
            "price": 160000,
            "power generation": 410000000,
            "construction time": 302400,
            "construction power factor": 0.15,
            "construction pollution": 8760000,
            "O&M cost" : 0.022,
            "consumed ressource": "hydropower",
            "amount consumed": 0,
            "pollution": 0,
            "ramping time": 0,
            "requirements": [["civil_engineering", 4, False]]
        },
        "CSP_solar": {
            "name": "Concentrated solar power",
            "price": 61000,
            "power generation": 19000000,
            "construction time": 129600,
            "construction power factor": 0.5,
            "construction pollution": 1260000,
            "O&M cost" : 0.067,
            "consumed ressource": "irradiation",
            "amount consumed": 0,
            "pollution": 0,
            "ramping time": 0,
            "requirements": [["physics", 5, False],
                             ["thermodynamics", 5, False]]
        },
        "PV_solar": {
            "name": "Photovoltaics",
            "price": 800000,
            "power generation": 59000000,
            "construction time": 21600,
            "construction power factor": 10,
            "construction pollution": 24000000,
            "O&M cost" : 0.02,
            "consumed ressource": "irradiation",
            "amount consumed": 0,
            "pollution": 0,
            "ramping time": 0,
            "requirements": [["physics", 6, False],
                             ["materials", 4, False]]
        },
        "offshore_wind_turbine": {
            "name": "Offshore wind turbine",
            "price": 3200000,
            "power generation": 130000000,
            "construction time": 172800,
            "construction power factor": 1.5,
            "construction pollution": 4900000,
            "O&M cost" : 0.065,
            "consumed ressource": "wind",
            "amount consumed": 0,
            "pollution": 0,
            "ramping time": 0,
            "requirements": [["aerodynamics", 3, False],
                             ["materials", 4, False],
                             ["mechanical_engineering", 6, False]]
        },
        "nuclear_reactor_gen4": {
            "name": "4th generation nuclear",
            "price": 1800000,
            "power generation": 335000000,
            "construction time": 518400,
            "construction power factor": 0.08,
            "construction pollution": 2400000,
            "O&M cost" : 0.085,
            "consumed ressource": "uranium",
            "amount consumed": 0.00057,
            "efficiency" : 0.3,
            "pollution": 3,
            "ramping time": 800,
            "requirements": [["chemistry", 5, False],
                             ["nuclear_engineering", 5, False]]
        },
        "small_pumped_hydro": {
            "name": "Small pumped hydro",
            "price": 19500,  # [¤]
            "storage capacity": 165700000,  # [Wh]
            "power generation": 2600000,  # [W]
            "efficiency": 0.75,
            "construction time": 18720,  # [s]
            "construction power factor": 0.005,  # fraction of capacity demanded during construction
            "construction pollution": 80000,  # [kg]
            "O&M cost" : 0.088,  # [fraction of price per year]
            "ramping time": 9,  # [min]
            "requirements": []
        },
        "compressed_air": {
            "name": "Compressed air",
            "price": 10700,
            "storage capacity": 2860000000,
            "power generation": 12000000,
            "efficiency": 0.52,
            "construction time": 64800,
            "construction power factor": 0.02,
            "construction pollution": 570000,
            "O&M cost" : 0.297,
            "ramping time": 5,
            "requirements": [["mechanical_engineering", 2, False],
                             ["thermodynamics", 2, False]]
        },
        "molten_salt": {
            "name": "Molten salt",
            "price": 27500,
            "storage capacity": 3000000000,
            "power generation": 55000000,
            "efficiency": 0.63,
            "construction time": 86400,
            "construction power factor": 0.03,
            "construction pollution": 1200000,
            "O&M cost" : 0.424,
            "ramping time": 60,
            "requirements": [["mechanical_engineering", 2, False],
                             ["thermodynamics", 3, False]]
        },
        "large_pumped_hydro": {
            "name": "Large pumped hydro",
            "price": 166000,
            "storage capacity": 6215000000,
            "power generation": 249000000,
            "efficiency": 0.8,
            "construction time": 334800,
            "construction power factor": 0.003,
            "construction pollution": 3000000,
            "O&M cost" : 0.115,
            "ramping time": 16,
            "requirements": [["civil_engineering", 3, False]]
        },
        "hydrogen_storage": {
            "name": "Hydrogen hydrolysis",
            "price": 160000,
            "storage capacity": 80000000000,
            "power generation": 15000000,
            "efficiency": 0.33,
            "construction time": 43200,
            "construction power factor": 0.005,
            "construction pollution": 2400000,
            "O&M cost" : 0.028,
            "ramping time": 8,
            "requirements": [["chemistry", 3, False],
                             ["materials", 3, False]]
        },
        "lithium_ion_batteries": {
            "name": "Lithium-ion batteries",
            "price": 3300000,
            "storage capacity": 3200000000,
            "power generation": 86000000,
            "efficiency": 0.69,
            "construction time": 64800,
            "construction power factor": 0.4,
            "construction pollution": 8000000,
            "O&M cost" : 0.003,
            "ramping time": 3,
            "requirements": [["chemistry", 4, False],
                             ["materials", 4, False]]
        },
        "solid_state_batteries": {
            "name": "Solid state batteries",
            "price": 5200000,
            "storage capacity": 5000000000,
            "power generation": 107000000,
            "efficiency": 0.79,
            "construction time": 54000,
            "construction power factor": 0.35,
            "construction pollution": 6000000,
            "O&M cost" : 0.002,
            "ramping time": 3,
            "requirements": [["chemistry", 6, False],
                             ["materials", 5, False],
                             ["physics", 6, False]]
        },
        "laboratory": {
            "name": "Laboratory",
            "price": 100000,  # [¤]
            "construction time": 5400,  # [s]
            "construction energy": 750000,  # [Wh]
            "construction pollution": 100000,  # [kg]
            "price multiplier": 1.3,
            "time factor": 0.9,
        },
        "warehouse": {
            "name": "Warehouse",
            "price": 50000,
            "construction time": 18000,
            "construction energy": 100000,
            "construction pollution": 25000,
            "price multiplier": 1.5,
            "capacity factor":1.5,
        },
        "industry": {
            "name": "Industry",
            "price": 1000/1.25,
            "construction time": 1200,
            "construction energy": 10000,
            "construction pollution": 1000,
            "power consumption": 50000, # [W]
            "income": 2000, # [¤/day]
            "price multiplier": 1.25,
            "power factor" : 1.4,
            "income factor" : 1.35,
        },
        "carbon_capture": {
            "name": "Carbon capture",
            "price": 250000,
            "construction time": 36000,
            "construction energy": 50000000,
            "construction pollution": 250000,
            "power consumption": 10000000, # [W]
            "absorbtion": 2000, # [kg/h]
            "price multiplier": 1.5,
            "absorbtion factor": 1.55,
            "power factor": 1.5,
            "requirements": [["mathematics", 3, False],
                             ["physics", 3, False],
                             ["chemistry", 3, False]]
        },
        "coal_mine": {
            "name": "Coal mine",
            "price": 28500,  # [¤]
            "construction time": 28800,  # [s]
            "construction power factor": 3,  # fraction of power consumption during construction
            "construction pollution": 200000,  # [kg]
            "O&M cost" : 0.25, # [fraction of price per year]
            "amount produced": 0.0000001,  # [fraction of total stock that can be extracted every minute by one mine]
            "power consumption": 3000000,  # [W]
            "pollution": 65,  # [kg/t extracted]
            "requirements": [["mineral_extraction", 1, False]]
        },
        "oil_field": {
            "name": "Oil field",
            "price": 370000,
            "construction time": 54000,
            "construction power factor": 5,
            "construction pollution": 400000,
            "O&M cost" : 0.26,
            "amount produced": 0.000001,
            "power consumption": 15300000,
            "pollution": 302,
            "requirements": [["mineral_extraction", 3, False]]
        },
        "gas_drilling_site": {
            "name": "Gas drilling site",
            "price": 335000,
            "construction time": 54000,
            "construction power factor": 6,
            "construction pollution": 700000,
            "O&M cost" : 0.26,
            "amount produced": 0.0000008,
            "power consumption": 11100000,
            "pollution": 523,
            "requirements": [["mineral_extraction", 3, False]]
        },
        "uranium_mine": {
            "name": "Uranium mine",
            "price": 1040000,
            "construction time": 86400,
            "construction power factor": 4,
            "construction pollution": 500000,
            "O&M cost" : 0.5,
            "amount produced": 0.0000004,
            "power consumption": 36000000,
            "pollution": 230000,
            "requirements": [["mineral_extraction", 5, False]]
        },
        "mathematics": {
            "name": "Mathematics",
            "price": 180000,  # [¤]
            "price multiplier": 1.3,
            "construction time": 18000,  # [s]
            "construction energy": 25000000,  # [Wh]
            "requirements": [["laboratory", 1, False]] # level is given relative to the research level 
        },
        "mechanical_engineering": {
            "name": "Mechanical engineering",
            "price": 180000,
            "price multiplier": 1.3,
            "construction time": 18000,
            "construction energy": 25000000,
            "price factor": 1.2,
            "prod factor" : 1.25,
            "requirements": [["laboratory", 1, False],
                             ["mathematics", 1, False]]
        },
        "thermodynamics": {
            "name": "Thermodynamics",
            "price": 180000,
            "price multiplier": 1.3,
            "construction time": 18000,
            "construction energy": 25000000,
            "efficiency factor" : 0.1,
            "requirements": [["laboratory", 1, False],
                             ["mathematics", 1, False]]
        },
        "physics": {
            "name": "Physics",
            "price": 180000,
            "price multiplier": 1.3,
            "construction time": 18000,
            "construction energy": 25000000,
            "price factor": 1.2,
            "prod factor" : 1.25,
            "requirements": [["laboratory", 1, False],
                             ["mathematics", 1, False],
                             ["chemistry", -1, False]]
        },
        "building_technology": {
            "name": "Building Technology",
            "price": 280000,
            "price multiplier": 1.3,
            "construction time": 28800,
            "construction energy": 80000000,
            "time factor": 0.9,
            "requirements": [["laboratory", 1, False],
                             ["mechanical_engineering", 1, False],
                             ["transport_technology", -1, False]]
        },
        "mineral_extraction": {
            "name": "Mineral extraction",
            "price": 160000, 
            "price multiplier": 1.4,
            "construction time": 14400, 
            "construction energy": 40000000,
            "price factor": 1.25,
            "prod factor" : 1.33,
            "energy factor": 1.28,
            "pollution factor": 0.9,
            "requirements": [["laboratory", 2, False],
                             ["building_technology", 1, False]]
        },
        "transport_technology": {
            "name": "Transport technology",
            "price": 280000,
            "price multiplier": 1.4,
            "construction time": 28800,
            "construction energy": 120000000,
            "time factor": 0.85,
            "energy factor": 0.9,
            "requirements": [["laboratory", 2, False],
                             ["mathematics", 2, False],
                             ["mechanical_engineering", 2, False]]
        },
        "materials": {
            "name": "Materials",
            "price": 420000,
            "price multiplier": 1.4,
            "construction time": 43200,
            "construction energy": 240000000,
            "price factor": 0.85,
            "construction energy factor": 0.9,
            "requirements": [["laboratory", 2, False],
                             ["mathematics", 2, False],
                             ["chemistry", 1, False]]
        },
        "civil_engineering": {
            "name": "Civil engineering",
            "price": 140000,
            "price multiplier": 1.5,
            "construction time": 14400,
            "construction energy": 80000000,
            "price factor": 1.4,
            "prod factor" : 1.3,
            "capacity factor": 1.3,
            "requirements": [["laboratory", 3, False],
                             ["mathematics", 2, False],
                             ["building_technology", 3, False]]
        },
        "aerodynamics": {
            "name": "Aerodynamics",
            "price": 420000,
            "price multiplier": 1.5,
            "construction time": 43200,
            "construction energy": 300000000,
            "price factor": 1.3,
            "prod factor" : 1.4,
            "requirements": [["laboratory", 3, False],
                             ["physics", 3, False],
                             ["building_technology", 3, False]]
        },
        "chemistry": {
            "name": "Chemistry",
            "price": 300000,
            "price multiplier": 1.4,
            "construction time": 28800,
            "construction energy": 200000000,
            "price factor": 1.25,
            "efficiency factor" : 0.9,
            "requirements": [["laboratory", 3, False],
                             ["physics", 0, False],
                             ["mathematics", 2, False]]
        },
        "nuclear_engineering": {
            "name": "Nuclear engineering",
            "price": 700000,
            "price multiplier": 1.5,
            "construction time": 64800,
            "construction energy": 540000000,
            "price factor": 1.3,
            "prod factor" : 1.4,
            "requirements": [["laboratory", 4, False],
                             ["physics", 3, False],
                             ["building_technology", 3, False],
                             ["mechanical_engineering", 3, False]]
        },
    },
    "warehouse_capacities":{
        "coal": 3000000/1.5, #[kg]
        "oil":   300000/1.5,
        "gas":  1000000/1.5,
        "uranium": 5000/1.5,
    },
    "transport": {
        "time" : 5000, #[s/distance unit]
        "power consumption" : 5000 #[Wh/t/distance unit]
    }
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
import copy

# config object that contains the modified data for a specific player considering the technologies he owns :
class Config(object):
    def __init__(config):
        config.for_player = {}

    # update mining speeds according to reserves depleation
    def update_resource_extraction(config, player_id):
        player = Player.query.get(player_id)
        if len(player.tile) == 0:
            return
        assets = config.for_player[player_id]["assets"]
        me_factor = assets["mineral_extraction"]["prod factor"] ** player.mineral_extraction
        assets["coal_mine"]["amount produced"] = full_config["assets"]["coal_mine"]["amount produced"] * player.tile[0].coal * me_factor
        assets["oil_field"]["amount produced"] = full_config["assets"]["oil_field"]["amount produced"] * player.tile[0].oil * me_factor
        assets["gas_drilling_site"]["amount produced"] = full_config["assets"]["gas_drilling_site"]["amount produced"] * player.tile[0].gas * me_factor
        assets["uranium_mine"]["amount produced"] = full_config["assets"]["uranium_mine"]["amount produced"] * player.tile[0].uranium * me_factor

    # regularly update minimg productivity for all players (mineral depletion)
    def update_mining_productivity(config):
        players = Player.query.all()
        for player in players:
            config.update_resource_extraction(player.id)

    # updating the config values according to the players technology level
    def update_config_for_user(config, player_id):
        config.for_player[player_id] = copy.deepcopy(full_config)
        assets = config.for_player[player_id]["assets"]
        player = Player.query.get(player_id)
        config.update_resource_extraction(player_id)

        for asset in assets:
            if asset in ["steam_engine", "watermill", "coal_burner", "oil_burner", "gas_burner", "combined_cycle", "compressed_air", "molten_salt"]:
                # update price and production (mechanical engineering)
                assets[asset]["price"] *= assets["mechanical_engineering"]["price factor"] ** player.mechanical_engineering
                assets[asset]["power generation"] *= assets["mechanical_engineering"]["prod factor"] ** player.mechanical_engineering

            if asset in ["steam_engine", "coal_burner", "oil_burner", "gas_burner", "nuclear_reactor", "nuclear_reactor_gen4"]:
                # update ressource consumption and pollution (thermodynamics)
                assets[asset]["amount consumed"] /= 1 + assets["thermodynamics"]["efficiency factor"] * player.thermodynamics
                assets[asset]["pollution"] /= 1 + assets["thermodynamics"]["efficiency factor"] * player.thermodynamics

            if asset == "combined_cycle":
                # special case for combined cycle (thermodynamics)
                assets[asset]["amount consumed"][0] /= 1 + assets["thermodynamics"]["efficiency factor"] * player.thermodynamics
                assets[asset]["amount consumed"][1] /= 1 + assets["thermodynamics"]["efficiency factor"] * player.thermodynamics
                assets[asset]["pollution"] /= 1 + assets["thermodynamics"]["efficiency factor"] * player.thermodynamics

            if asset == "compressed_air":
                # special case for compressed air rountrip efficiency (thermodynamics)
                assets[asset]["efficiency"] += 0.05 * player.thermodynamics * assets[asset]["efficiency"]

            if asset == "molten_salt":
                # special case for molten salt efficiency (thermodynamics)
                assets[asset]["efficiency"] = 1 - (1-assets[asset]["efficiency"]) * (0.9**player.thermodynamics)

            if asset in ["PV_solar", "CSP_solar", "hydrogen_storage", "lithium_ion_batteries", "solid_state_batteries"]:
                # update price and production (physics)
                assets[asset]["price"] *= assets["physics"]["price factor"] ** player.physics
                assets[asset]["power generation"] *= assets["physics"]["prod factor"] ** player.physics

            if asset in ["coal_mine", "oil_field", "gas_drilling_site", "uranium_mine"]:
                # update price, energy consumption and pollution. production increase is already in update_resource_extraction (mineral extraction)
                assets[asset]["price"] *= assets["mineral_extraction"]["price factor"] ** player.mineral_extraction
                assets[asset]["power consumption"] *= assets["mineral_extraction"]["energy factor"] ** player.mineral_extraction
                assets[asset]["pollution"] *= assets["mineral_extraction"]["pollution factor"] ** player.mineral_extraction

            if asset in ["PV_solar", "onshore_wind_turbine", "offshore_wind_turbine", "lithium_ion_batteries", "solid_state_batteries"]:
                # update price (materials)
                assets[asset]["price"] *= assets["materials"]["price factor"] ** player.materials
                assets[asset]["construction power factor"] *= assets["materials"]["construction energy factor"] ** player.materials

            if asset in ["small_water_dam", "large_water_dam", "small_pumped_hydro", "large_pumped_hydro"]:
                # update price and production (civil engineering)
                assets[asset]["price"] *= assets["civil_engineering"]["price factor"] ** player.civil_engineering
                assets[asset]["power generation"] *= assets["civil_engineering"]["prod factor"] ** player.civil_engineering
            
            if asset in ["small_pumped_hydro", "large_pumped_hydro"]:
                # update capacity (civil engineering)
                assets[asset]["storage capacity"] *= assets["civil_engineering"]["capacity factor"] ** player.civil_engineering

            if asset in ["windmill", "onshore_wind_turbine", "offshore_wind_turbine"]:
                # update price and production (aerodynamics)
                assets[asset]["price"] *= assets["aerodynamics"]["price factor"] ** player.aerodynamics
                assets[asset]["power generation"] *= assets["aerodynamics"]["prod factor"] ** player.aerodynamics

            if asset in ["lithium_ion_batteries", "solid_state_batteries"]:
                # update roundtrip efficiencies (chemistry)
                assets[asset]["efficiency"] = 1 - (1-assets[asset]["efficiency"]) * (assets["chemistry"]["efficiency factor"]**player.chemistry)

            if asset == "hydrogen_storage":
                # special case for hydrogen storage rountrip efficiency (chemistry)
                assets[asset]["efficiency"] += 0.05 * player.chemistry * assets[asset]["efficiency"]

            if asset in ["nuclear_reactor", "nuclear_reactor_gen4"]:
                # update price and production (nuclear engineering)
                assets[asset]["price"] *= assets["nuclear_engineering"]["price factor"] ** player.nuclear_engineering
                assets[asset]["power generation"] *= assets["nuclear_engineering"]["prod factor"] ** player.nuclear_engineering

            if asset in ["laboratory", "warehouse", "industry", "carbon_capture", "mathematics", "mechanical_engineering", "thermodynamics", "physics", "building_technology", "mineral_extraction", "transport_technology", "materials", "civil_engineering", "aerodynamics", "chemistry", "nuclear_engineering"]:
                # update prices, construction time and construction energy
                assets[asset]["price"] *= assets[asset]["price multiplier"] ** getattr(player, asset)
                assets[asset]["construction time"] *= assets[asset]["price multiplier"] ** (0.75*getattr(player, asset))
                assets[asset]["construction energy"] *= assets[asset]["price multiplier"] ** (1.25*getattr(player, asset))
                if asset in ["laboratory", "warehouse", "industry", "carbon_capture"]:
                    assets[asset]["construction pollution"] *= assets[asset]["price multiplier"] ** (getattr(player, asset))

            if asset in ["mathematics", "mechanical_engineering", "thermodynamics", "physics", "building_technology", "mineral_extraction", "transport_technology", "materials", "civil_engineering", "aerodynamics", "chemistry", "nuclear_engineering"]:
                # update research time (laboratory)
                assets[asset]["construction time"] *= assets["laboratory"]["time factor"] ** player.laboratory
                # remove fulfilled reqirements
                assets[asset]["locked"] = False
                for req in assets[asset]["requirements"]:
                    if req[1] + getattr(player, asset) < 1:
                        assets[asset]["requirements"].remove(req)
                        continue
                    req[2] = getattr(player, req[0]) >= req[1] + getattr(player, asset)
                    if not req[2]:
                        assets[asset]["locked"] = True

            if asset in ["watermill", "small_water_dam", "large_water_dam", "nuclear_reactor", "nuclear_reactor_gen4", "steam_engine", "coal_burner", "oil_burner", "gas_burner", "combined_cycle", "windmill", "onshore_wind_turbine", "offshore_wind_turbine", "CSP_solar", "PV_solar", "small_pumped_hydro", "large_pumped_hydro", "lithium_ion_batteries", "solid_state_batteries", "compressed_air", "molten_salt", "hydrogen_storage"]:
                # update construction time (building technology)
                assets[asset]["construction time"] *= assets["building_technology"]["time factor"] ** player.building_technology

            if asset == "industry":
                # calculating industry energy consumption and income
                assets[asset]["power consumption"] *= assets["industry"]["power factor"] ** player.industry
                assets[asset]["income"] *= assets["industry"]["income factor"] ** player.industry

            if asset in ["watermill", "small_water_dam", "large_water_dam", "nuclear_reactor", "nuclear_reactor_gen4", "steam_engine", "coal_burner", "oil_burner", "gas_burner", "combined_cycle", "windmill", "onshore_wind_turbine", "offshore_wind_turbine", "CSP_solar", "PV_solar", "small_pumped_hydro", "large_pumped_hydro", "lithium_ion_batteries", "solid_state_batteries", "compressed_air", "molten_salt", "hydrogen_storage", "coal_mine", "oil_field", "gas_drilling_site", "uranium_mine"]:
                # remove fulfilled reqirements
                assets[asset]["locked"] = False
                for req in assets[asset]["requirements"]:
                    req[2] = getattr(player, req[0]) >= req[1]
                    if not req[2]:
                        assets[asset]["locked"] = True
                # calculate O&M cost
                assets[asset]["O&M cost"] *= assets[asset]["price"]/24

            if asset == "carbon_capture":
                # remove fulfilled reqirements
                assets[asset]["locked"] = False
                for req in assets[asset]["requirements"]:
                    req[2] = getattr(player, req[0]) >= req[1]
                    if not req[2]:
                        assets[asset]["locked"] = True

            # calculating the ramping speed in W/min from the ramping time
            if "ramping time" in assets[asset]:
                if assets[asset]["ramping time"] == 0:
                    assets[asset]["ramping speed"] = 0
                else: 
                    assets[asset]["ramping speed"] = assets[asset]["power generation"]/assets[asset]["ramping time"]

            # calculate energy need : 
            if asset in ["watermill", "small_water_dam", "large_water_dam", "nuclear_reactor", "nuclear_reactor_gen4", "steam_engine", "coal_burner", "oil_burner", "gas_burner", "combined_cycle", "windmill", "onshore_wind_turbine", "offshore_wind_turbine", "CSP_solar", "PV_solar"]:
                assets[asset]["construction power"] = assets[asset]["construction power factor"] * assets[asset]["power generation"] / (assets["building_technology"]["time factor"] ** player.building_technology)
            elif asset in ["small_pumped_hydro", "large_pumped_hydro", "lithium_ion_batteries", "solid_state_batteries", "compressed_air", "molten_salt", "hydrogen_storage"]:
                assets[asset]["construction power"] = assets[asset]["construction power factor"] * assets[asset]["storage capacity"] / (assets["building_technology"]["time factor"] ** player.building_technology)
            elif asset in ["coal_mine", "oil_field", "gas_drilling_site", "uranium_mine"]:
                assets[asset]["construction power"] = assets[asset]["construction power factor"] * assets[asset]["power consumption"]
            else :
                assets[asset]["construction power"] = assets[asset]["construction energy"]/assets[asset]["construction time"]*3600

        # calculating the maximum storage capacity from the warehouse level
        max_cap = config.for_player[player_id]["warehouse_capacities"]
        for ressource in max_cap:
            if player.warehouse == 0:
                max_cap[ressource] = 0
            else :
                max_cap[ressource] *= assets["warehouse"]["capacity factor"] ** player.warehouse

        # calculating the transport speed and energy consumption from the level of transport technology
        config.for_player[player_id]["transport"]["time"] *= assets["transport_technology"]["time factor"] ** player.transport_technology
        config.for_player[player_id]["transport"]["power consumption"] *= assets["transport_technology"]["energy factor"] ** player.transport_technology


    def __getitem__(config, player_id):
        if player_id not in config.for_player:
            config.update_config_for_user(player_id)
        return config.for_player[player_id]


config = Config()
