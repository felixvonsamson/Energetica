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

from .production_update import update_ressources, update_electricity

def state_update_h(engine, app):
  with app.app_context():
    update_ressources(engine)

def state_update_m(engine, app):
  with app.app_context():
    update_electricity(engine)


def check_heap(engine, app):
  #engine.log("checking heap")
  while heap and heap[0][0] < time.time():
    _,function,args = heapq.heappop(heap)
    with app.app_context():
      function(*args)
