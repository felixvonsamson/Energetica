import time
import heapq
from flask import request, session, flash, g, current_app
from flask_login import current_user
from . import heap
from .database import Player
from .utils import add_asset
from . import db


def add_handlers(socketio, engine):

  @socketio.on("give_identity")
  def give_identity():
    player = Player.query.get(int(session["ID"]))
    player.sid = request.sid

  @socketio.on("start_construction")
  def start_construction(building):
    config = current_app.config["engine"].config[session["ID"]]
    if(current_user.money < config["assets"][building]["price"]):
      flash('Not enough money', category='error')
    else :
      current_user.money -= config["assets"][building]["price"]
      db.session.commit()
      heapq.heappush(heap, (time.time()+config["assets"][building]["construction time"],add_asset,(session["ID"], building)))