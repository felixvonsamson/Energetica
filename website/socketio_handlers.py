import datetime
from flask import request, session

def add_handlers(socketio, engine):
  @socketio.on("start_construction")
  def start_construction(building):
    engine.log("button is working")