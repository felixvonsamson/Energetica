import datetime
import pickle
import secrets
import logging

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

  def update_fields(engine, updates, players=None):
    socketio = engine.socketio
    if players:
      for player in players:
        if player.sid:
          player.emit("update_data", updates)
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
