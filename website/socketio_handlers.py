import time
import heapq
from flask import request, session, flash
from . import heap
from .config import config
from .database import Player


def add_handlers(socketio, engine):

  @socketio.on("give_identity")
  def give_identity():
    player = Player.query.get(int(session["ID"]))
    player.sid = request.sid

  @socketio.on("start_construction")
  def start_construction(family, building):
    player = Player.query.get(session["ID"])
    if(player.money < config["assets"][building]["price"]):
      flash('Not enough money', category='error')
    else :
      heapq.heappush(heap, (time.time()+config["assets"][building]["construction time"],add_building,(family ,building)))