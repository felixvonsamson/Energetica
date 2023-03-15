import datetime
import pickle
import secrets
import logging
from flask import url_for
from . import heap
import time
import heapq
from .database import Player

from .config import config
class gameEngine(object):

  def __init__(engine):
    engine.config = config
    
    engine.socketio = None

    engine.logger = logging.getLogger("Energetica")
    engine.init_logger()
    engine.logs = []
    engine.nonces = set()
    
    engine.log("engine created")

  def init_logger(engine):
    engine.logger.setLevel(logging.INFO)
    s_handler = logging.StreamHandler()
    s_handler.setLevel(logging.INFO)
    engine.logger.addHandler(s_handler)

  def get_nonce(engine):
    while True:
      nonce = secrets.token_hex(16)
      if nonce not in engine.nonces:
        return nonce
  
  def use_nonce(engine, nonce):
    if nonce in engine.nonces:
      return False
    engine.nonces.add(nonce)
    return True
  
  def force_refresh(engine):
    engine.socketio.emit("refresh", broadcast=True)

  def update_fields(engine, updates, player=None):
    socketio = engine.socketio
    if player:
      if player.sid:
        socketio.emit("update_data", updates)
    else:
      socketio.emit("update_data", updates, broadcast=True)

  def log(engine, message):
    log_message = datetime.datetime.now().strftime("%H:%M:%S : ") + message
    engine.logger.info(log_message)
    engine.logs.append(log_message)


  def save_data(engine):
    socketio = engine.socketio
    engine.socketio = None
    with open("data.pck", "wb") as file:
      pickle.dump(engine, file)
    engine.socketio = socketio

  @staticmethod
  def load_data():
    with open("data.pck", "rb") as file:
      engine = pickle.load(file)
    engine.init_logger()
    return engine


from .utils import add_asset

def daily_update(engine, app):
  with app.app_context():
    with open('website/static/data/industry_demand.pck', "rb") as file:
      industry_demand = pickle.load(file)
    players = Player.query.all()
    for player in players :
      player.todays_production["demand"]["industriy"] = [i*50000 for i in industry_demand]

def state_update_h(engine, app):
  with app.app_context():
    t = datetime.datetime.today().time().hour
    players = Player.query.all()
    for player in players :
      player.todays_production["ressources"]["coal"][t] = player.coal_mine * engine.config["assets"]["coal_mine"]["amount produced"]
      player.todays_production["ressources"]["oil"][t] = player.oil_field * engine.config["assets"]["oil_field"]["amount produced"]
      player.todays_production["ressources"]["gas"][t] = player.gas_drilling_site * engine.config["assets"]["gas_drilling_site"]["amount produced"]
      player.todays_production["ressources"]["uranium"][t] = player.uranium_mine * engine.config["assets"]["uranium_mine"]["amount produced"]

def state_update_m(engine, app):
  with app.app_context():
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
        construction = engine.config[player.id].config["assets"][ud.name]
        demand_construction += construction["construction energy"]/construction["construction time"]*60
      player.todays_production["demand"]["construction"][t] = demand_construction


def check_heap(engine, app):
  #engine.log("checking heap")
  while heap and heap[0][0] < time.time():
    _,function,args = heapq.heappop(heap)
    with app.app_context():
      function(*args)
