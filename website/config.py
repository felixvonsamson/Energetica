full_config = {

  "assets": {
    "steam_engine": {
      "name" : "Steam engine",
      "price" : 200, #[CHF]
      "power production" : 25000, #[W]
      "construction time" : 10, #[s]
      "construction energy" : 10000, #[Wh]
      "construction pollution" : 12000, #[kg]
      "consumed ressource" : "money",
      "amount consumed" : 100,
      "pollution" : 494, #[g/kW]
      "startup time" : 1800 #[s]
    },
    "windmill": {
      "name" : "Windmill",
      "price" : 15000,
      "power production" : 3000,
      "construction time" : 18000,
      "construction energy" : 3000,
      "construction pollution" : 12000,
      "consumed ressource" : "wind",
      "amount consumed" : 0,
      "pollution" : 0,
      "startup time" : 0
    },
    "watermill": {
      "name" : "Watermill",
      "price" : 50000,
      "power production" : 10000,
      "construction time" : 36000,
      "construction energy" : 5000,
      "construction pollution" : 12000,
      "consumed ressource" : "water",
      "amount consumed" : 0,
      "pollution" : 0,
      "startup time" : 0
    },
    "coal_burner": {
      "name" : "Coal burner",
      "price" : 5000000,
      "power production" : 120000000,
      "construction time" : 172800,
      "construction energy" : 17280,
      "construction pollution" : 12000,
      "consumed ressource" : "coal",
      "amount consumed" : 60000,
      "pollution" : 986,
      "startup time" : 3600
    },
    "oil_burner": {
      "name" : "Oil burner",
      "price" : 5000000,
      "power production" : 80000000,
      "construction time" : 172800,
      "construction energy" : 17280,
      "construction pollution" : 12000,
      "consumed ressource" : "oil",
      "amount consumed" : 21818,
      "pollution" : 777,
      "startup time" : 3600
    },
    "gas_burner": {
      "name" : "Gas burner",
      "price" : 5000000,
      "power production" : 100000000,
      "construction time" : 172800,
      "construction energy" : 17280,
      "construction pollution" : 12000,
      "consumed ressource" : "gas",
      "amount consumed" : 21818,
      "pollution" : 429,
      "startup time" : 3600
    },
    "shallow_geothermal_plant": {
      "name" : "Shallow geothermal plant",
      "price" : 1000000,
      "power production" : 350000,
      "construction time" : 172800,
      "construction energy" : 17280,
      "construction pollution" : 12000,
      "consumed ressource" : "geothermy",
      "amount consumed" : 0,
      "pollution" : 6,
      "startup time" : 7200
    },
    "small_water_dam": {
      "name" : "Small water dam",
      "price" : 400000000,
      "power production" : 200000000,
      "construction time" : 172800,
      "construction energy" : 17280,
      "construction pollution" : 12000,
      "consumed ressource" : "hydropower",
      "amount consumed" : 0,
      "pollution" : 0,
      "startup time" : 300
    },
    "wind_turbine": {
      "name" : "Wind turbine",
      "price" : 2000000,
      "power production" : 500000,
      "construction time" : 172800,
      "construction energy" : 17280,
      "construction pollution" : 12000,
      "consumed ressource" : "wind",
      "amount consumed" : 0,
      "pollution" : 0,
      "startup time" : 0
    },
    "combined_cycle": {
      "name" : "Combined cycle",
      "price" : 300000000,
      "power production" : 530000000,
      "construction time" : 172800,
      "construction energy" : 17280,
      "construction pollution" : 12000,
      "consumed ressource" : ["gas", "coal"],
      "amount consumed" : [60000, 9000],
      "pollution" : 488,
      "startup time" : 7200
    },
    "deep_geothermal_plant": {
      "name" : "Deep geothermal plant",
      "price" : 250000000,
      "power production" : 120000000,
      "construction time" : 172800,
      "construction energy" : 17280,
      "construction pollution" : 12000,
      "consumed ressource" : "geothermy",
      "amount consumed" : 0,
      "pollution" : 10,
      "startup time" : 10800
    },
    "nuclear_reactor": {
      "name" : "Nuclear reactor",
      "price" : 1000000000,
      "power production" : 900000000,
      "construction time" : 172800,
      "construction energy" : 17280,
      "construction pollution" : 12000,
      "consumed ressource" : "uranium",
      "amount consumed" : 360,
      "pollution" : 2,
      "startup time" : 259200
    },
    "large_water_dam": {
      "name" : "Large water dam",
      "price" : 2000000000,
      "power production" : 1200000000,
      "construction time" : 172800,
      "construction energy" : 17280,
      "construction pollution" : 12000,
      "consumed ressource" : "hydropower",
      "amount consumed" : 0,
      "pollution" : 0,
      "startup time" : 600
    },
    "CSP_solar": {
      "name" : "Concentrated solar power",
      "price" : 800000000,
      "power production" : 400000,
      "construction time" : 172800,
      "construction energy" : 17280,
      "construction pollution" : 12000,
      "consumed ressource" : "irradiation",
      "amount consumed" : 0,
      "pollution" : 0,
      "startup time" : 1800
    },
    "PV_solar": {
      "name" : "Photovoltaics",
      "price" : 1200,
      "power production" : 900,
      "construction time" : 172800,
      "construction energy" : 17280,
      "construction pollution" : 12000,
      "consumed ressource" : "irradiation",
      "amount consumed" : 0,
      "pollution" : 0,
      "startup time" : 0
    },
    "large_wind_turbine": {
      "name" : "Large wind turbine",
      "price" : 7000000,
      "power production" : 2500000,
      "construction time" : 172800,
      "construction energy" : 17280,
      "construction pollution" : 12000,
      "consumed ressource" : "wind",
      "amount consumed" : 0,
      "pollution" : 0,
      "startup time" : 0
    },
    "nuclear_reactor_gen4": {
      "name" : "4th generation nuclear",
      "price" : 9000000000,
      "power production" : 2500000000,
      "construction time" : 172800,
      "construction energy" : 17280,
      "construction pollution" : 12000,
      "consumed ressource" : "uranium",
      "amount consumed" : 3,
      "pollution" : 2,
      "startup time" : 432000
    },
    "small_pumped_hydro": {
      "name" : "Small pumped hydro",
      "price" : 400000000, #[CHF]
      "storage capacity" : 3000000000, #[Wh]
      "power production" : 55000000, #[W]
      "efficiency" : 0.75,
      "construction time" : 36000, #[s]
      "construction energy" : 10000, #[Wh]
      "construction pollution" : 12000, #[kg]
      "startup time" : 180
    },
    "compressed_air": {
      "name" : "Compressed air",
      "price" : 1200000000,
      "storage capacity" : 100000000,
      "power production" : 20000000,
      "efficiency" : 0.60,
      "construction time" : 36000,
      "construction energy" : 10000,
      "construction pollution" : 12000,
      "startup time" : 180
    },
    "molten_salt": {
      "name" : "Molten salt",
      "price" : 30000000,
      "storage capacity" : 600000000,
      "power production" : 240000000,
      "efficiency" : 0.92,
      "construction time" : 36000,
      "construction energy" : 10000,
      "construction pollution" : 12000,
      "startup time" : 14400
    },
    "large_pumped_hydro": {
      "name" : "Large pumped hydro",
      "price" : 1300000000,
      "storage capacity" : 16000000000,
      "power production" : 400000000,
      "efficiency" : 0.8,
      "construction time" : 36000,
      "construction energy" : 10000,
      "construction pollution" : 12000,
      "startup time" : 300
    },
    "hydrogen_storage": {
      "name" : "Hydrogen hydrolysis",
      "price" : 7000000,
      "storage capacity" : 80000000000000,
      "power production" : 750000000,
      "efficiency" : 0.4,
      "construction time" : 36000,
      "construction energy" : 10000,
      "construction pollution" : 12000,
      "startup time" : 72000
    },
    "lithium_ion_batteries": {
      "name" : "Lithium-ion batteries",
      "price" : 150000000,
      "storage capacity" : 100000000,
      "power production" : 20000000,
      "efficiency" : 0.98,
      "construction time" : 36000,
      "construction energy" : 10000,
      "construction pollution" : 12000,
      "startup time" : 30
    },
    "solid_state_batteries": {
      "name" : "Solid state batteries",
      "price" : 350000000,
      "storage capacity" : 140000000,
      "power production" : 30000000,
      "efficiency" : 0.99,
      "construction time" : 36000,
      "construction energy" : 10000,
      "construction pollution" : 12000,
      "startup time" : 30
    },
    "laboratory": {
      "name" : "Laboratory",
      "price" : 2500000, #[CHF]
      "construction time" : 36000, #[s]
      "construction energy" : 10000, #[Wh]
      "construction pollution" : 12000 #[kg]
    },
    "warehouse": {
      "name" : "Warehouse",
      "price" : 400000,
      "construction time" : 36000,
      "construction energy" : 10000,
      "construction pollution" : 12000
    },
    "industry": {
      "name" : "Industry",
      "price" : 5000,
      "construction time" : 36000,
      "construction energy" : 10000,
      "construction pollution" : 12000
    },
    "military_barracks": {
      "name" : "Military barracks",
      "price" : 80000000,
      "construction time" : 36000,
      "construction energy" : 10000,
      "construction pollution" : 12000
    },
    "coal_mine": {
      "name" : "Coal mine",
      "price" : 2500000, #[CHF]
      "construction time" : 36000, #[s]
      "construction energy" : 10000, #[Wh]
      "construction pollution" : 12000, #[kg]
      "amount produced" : 3000, #[kg/h]
      "power consumption" : 3000, #[W]
      "pollution" : 2 #[kg/h]
    },
    "oil_field": {
      "name" : "Oil field",
      "price" : 2500000,
      "construction time" : 36000,
      "construction energy" : 10000,
      "construction pollution" : 12000,
      "amount produced" : 3000,
      "power consumption" : 3000,
      "pollution" : 2
    },
    "gas_drilling_site": {
      "name" : "Gas drilling site",
      "price" : 2500000,
      "construction time" : 36000,
      "construction energy" : 10000,
      "construction pollution" : 12000,
      "amount produced" : 3000,
      "power consumption" : 3000,
      "pollution" : 2
    },
    "uranium_mine": {
      "name" : "Uranium mine",
      "price" : 2500000,
      "construction time" : 36000,
      "construction energy" : 10000,
      "construction pollution" : 12000,
      "amount produced" : 3000,
      "power consumption" : 3000,
      "pollution" : 2
    },
    "mineral_extraction": {
      "name" : "Mineral extraction",
      "price" : 40000, #[CHF]
      "price multiplier" : 1.3,
      "construction time" : 36000, #[s]
      "construction energy" : 10000, #[Wh]
    },
    "civil_engeneering": {
      "name" : "Civil engeneering",
      "price" : 40000,
      "price multiplier" : 1.3,
      "construction time" : 36000,
      "construction energy" : 10000,
    },
    "mechanical_engeneering": {
      "name" : "Mechanical engeneering",
      "price" : 40000,
      "price multiplier" : 1.3,
      "construction time" : 36000,
      "construction energy" : 10000,
    },
    "physics": {
      "name" : "Physics",
      "price" : 40000,
      "price multiplier" : 1.3,
      "construction time" : 36000,
      "construction energy" : 10000,
    },
    "materials": {
      "name" : "Materials",
      "price" : 40000,
      "price multiplier" : 1.3,
      "construction time" : 36000,
      "construction energy" : 10000,
    },
    "carbon_capture": {
      "name" : "Carbon capture",
      "price" : 40000,
      "price multiplier" : 1.3,
      "construction time" : 36000,
      "construction energy" : 10000,
    },
    "transport_technology": {
      "name" : "Transport technology",
      "price" : 40000,
      "price multiplier" : 1.3,
      "construction time" : 36000,
      "construction energy" : 10000,
    },
    "aerodynamics": {
      "name" : "Aerodynamics",
      "price" : 40000,
      "price multiplier" : 1.3,
      "construction time" : 36000,
      "construction energy" : 10000,
    },
    "geology": {
      "name" : "Geology",
      "price" : 40000,
      "price multiplier" : 1.3,
      "construction time" : 36000,
      "construction energy" : 10000,
    }
  }

}

capacity_table = {
    "steam_engine": "c_fossil",
    "windmill": "c_wind",
    "watermill": "c_hydro",
    "coal_burner": "c_fossil",
    "oil_burner": "c_fossil",
    "gas_burner": "c_fossil",
    "shallow_geothermal_plant": "c_geothermal",
    "small_water_dam": "c_hydro",
    "wind_turbine": "c_wind",
    "combined_cycle": "c_fossil",
    "deep_geothermal_plant": "c_geothermal",
    "nuclear_reactor": "c_nuclear",
    "large_water_dam": "c_hydro",
    "CSP_solar": "c_solar",
    "PV_solar": "c_solar",
    "large_wind_turbine": "c_wind",
    "nuclear_reactor_gen4": "c_nuclear",
    "small_pumped_hydro": "c_pumped_hydro",
    "compressed_air": "c_compressed_air",
    "molten_salt": "c_molten_salt",
    "large_pumped_hydro": "c_pumped_hydro",
    "hydrogen_storage": "c_hydrogen",
    "lithium_ion_batteries": "c_batteries",
    "solid_state_batteries": "c_batteries"
}

capacities = [
  "c_fossil",
  "c_wind",
  "c_hydro",
  "c_geothermal",
  "c_nuclear",
  "c_solar",
  "c_pumped_hydro",
  "c_compressed_air",
  "c_molten_salt",
  "c_hydrogen",
  "c_batteries"
]


from .database import Player
class Config(object):
  def __init__(config):
    config.for_player = {}
  def update_config_for_user(config, player_id):
    config.for_player[player_id] = full_config
  def __getitem__(config, player_id):
    if player_id not in config.for_player:
      config.update_config_for_user(player_id)
    return config.for_player[player_id]

config = Config()
