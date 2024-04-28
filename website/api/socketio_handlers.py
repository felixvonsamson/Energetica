"""
This code contains the main functions that communicate with the server (server side)
"""

from flask import request
from flask_login import current_user

from ..database.messages import Chat

from ..database.player import Player
from ..database.messages import Message
from ..utils import check_existing_chats
from .. import db
from datetime import datetime


def add_handlers(socketio, engine):
    @socketio.on("connect")
    def handle_connect():
        if current_user.is_anonymous:
            return
        # Store client's sid when connected
        if current_user.id not in engine.clients:
            engine.clients[current_user.id] = []
        engine.clients[current_user.id].append(request.sid)

    @socketio.on("disconnect")
    def handle_disconnect():
        # Remove client's sid when disconnected
        if request.sid in engine.clients[current_user.id]:
            engine.clients[current_user.id].remove(request.sid)
