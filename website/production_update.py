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
    player.todays_production["production"]["fossil"][t] = player.c_fossil
    player.todays_production["production"]["wind"][t] = player.c_wind
    player.todays_production["production"]["hydro"][t] = player.c_hydro
    player.todays_production["production"]["geothermal"][t] = player.c_geothermal
    player.todays_production["production"]["nuclear"][t] = player.c_nuclear
    player.todays_production["production"]["solar"][t] = player.c_solar
    player.todays_production["storage"]["pumped_hydro"][t] = player.c_pumped_hydro
    player.todays_production["storage"]["compressed_air"][t] = player.c_compressed_air
    player.todays_production["storage"]["molten_salt"][t] = player.c_molten_salt
    player.todays_production["storage"]["hydrogen"][t] = player.c_hydrogen
    player.todays_production["storage"]["batteries"][t] = player.c_batteries

    demand_construction = 0
    for ud in player.under_construction :
      construction = engine.config[player.id]["assets"][ud.name]
      demand_construction += construction["construction energy"]/construction["construction time"]*60
    player.todays_production["demand"]["construction"][t] = demand_construction