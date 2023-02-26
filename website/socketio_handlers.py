import time
import heapq
from flask import request, session, flash, g, current_app
from flask_login import current_user
from . import heap
from .database import Player, Under_construction
from .utils import add_asset, display_CHF
from . import db


def add_handlers(socketio, engine):

  @socketio.on("give_identity")
  def give_identity():
    player = Player.query.get(int(session["ID"]))
    player.sid = request.sid
    db.session.commit()

  @socketio.on("start_construction")
  def start_construction(building):
    config = current_app.config["engine"].config[session["ID"]]
    if(current_user.money < config["assets"][building]["price"]):
      flash('Not enough money', category='error') # doesn't work
    else :
      current_user.money -= config["assets"][building]["price"]
      db.session.commit()
      updates = [("money", display_CHF(current_user.money))]
      engine.update_fields(updates, current_user)
      finish_time = time.time()+config["assets"][building]["construction time"]
      heapq.heappush(heap, (finish_time, add_asset, (session["ID"], building)))
      new_building = Under_construction(name=building, start_time=time.time(), finish_time=finish_time, player_id=session["ID"])
      db.session.add(new_building)
      db.session.commit()