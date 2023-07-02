import datetime
from .database import Player

def update_ressources(engine):
  t = datetime.datetime.today().time().hour
  players = Player.query.all()
  for player in players :
    player.todays_production["ressources"]["coal"][t] = player.coal_mine * engine.config[player.id]["assets"]["coal_mine"]["amount produced"]
    player.todays_production["ressources"]["oil"][t] = player.oil_field * engine.config[player.id]["assets"]["oil_field"]["amount produced"]
    player.todays_production["ressources"]["gas"][t] = player.gas_drilling_site * engine.config[player.id]["assets"]["gas_drilling_site"]["amount produced"]
    player.todays_production["ressources"]["uranium"][t] = player.uranium_mine * engine.config[player.id]["assets"]["uranium_mine"]["amount produced"]

def update_electricity(engine):
  now = datetime.datetime.today().time()
  t = now.hour * 60 + now.minute
  players = Player.query.all()
  for player in players :

    demand_construction = 0
    for ud in player.under_construction :
      construction = engine.config[player.id]["assets"][ud.name]
      demand_construction += construction["construction energy"]/construction["construction time"]*60
    player.todays_production["demand"]["construction"][t] = demand_construction
    total_demand = sum([player.todays_production["demand"][i][t] for i in player.todays_production["demand"]])

    #put this in dayly updates
    total_production = 0 
    for plant in ["windmill", "watermill", "small_water_dam", "wind_turbine", "large_water_dam", "CSP_solar", "PV_solar", "large_wind_turbine"]:
      #update non-controllable producion
      pass

    controllable_plants = ["steam_engine", "coal_burner", "oil_burner", "gas_burner", "shallow_geothermal_plant", "combined_cycle", "deep_geothermal_plant", "nuclear_reactor", "nuclear_reactor_gen4"]
    for plant in controllable_plants:
      player.todays_production["production"][plant][t] = max(0,player.todays_production["production"][plant][t-1]-getattr(player, plant)*engine.config[player.id]["assets"][plant]["ramping speed"])
      total_production += player.todays_production["production"][plant][t]
    priority_list = ["steam_engine", "coal_burner", "oil_burner", "gas_burner", "shallow_geothermal_plant", "combined_cycle", "deep_geothermal_plant", "nuclear_reactor", "nuclear_reactor_gen4"]
    i = 0
    while total_production < total_demand:
      plant = priority_list[i]
      delta_prod = getattr(player, plant)*engine.config[player.id]["assets"][plant]["ramping speed"] + player.todays_production["production"][plant][t-1]-player.todays_production["production"][plant][t]
      if total_demand-total_production < delta_prod:
        max_prod = getattr(player, plant)*engine.config[player.id]["assets"][plant]["power production"]
        if player.todays_production["production"][plant][t] + total_demand-total_production > max_prod:
          total_production += max_prod - player.todays_production["production"][plant][t]
          player.todays_production["production"][plant][t] = max_prod
        else :
          player.todays_production["production"][plant][t] += total_demand-total_production
          total_production = total_demand
      else :
        total_production += delta_prod
        player.todays_production["production"][plant][t] += delta_prod
      i+=1
      if i >= len(priority_list):
        break

    