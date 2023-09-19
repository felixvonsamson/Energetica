"""
This code contains the main functions that communicate with the server (server side)
"""

import time
import heapq
from flask import request, session, flash, g, current_app
from flask_login import current_user
from . import heap
from .database import Player, Hex, Under_construction, Chat, Message
from .utils import add_asset, display_CHF, check_existing_chats
from . import db

def add_handlers(socketio, engine):
    # ???
    @socketio.on("give_identity")
    def give_identity():
        player = current_user
        player.sid = request.sid
        db.session.commit()

    # this function is executed when a player choses a tile
    @socketio.on("choose_location")
    def choose_location(id):
        location = Hex.query.get(id + 1)
        if location.player_id != None:
            current_user.emit("errorMessage", "Location already taken")
        else:
            location.player_id = current_user.id
            db.session.commit()
            engine.refresh()

    # this function is executed when a player creates a new group chat
    @socketio.on("create_group_chat")
    def create_group_chat(title, group):
        groupMembers = [current_user]
        for username in group:
            groupMembers.append(Player.query.filter_by(username=username).first())
        if check_existing_chats(groupMembers):
            current_user.emit("errorMessage", "Chat already exists")
            return
        new_chat = Chat(name=title, participants=groupMembers)
        db.session.add(new_chat)
        db.session.commit()
        engine.refresh()

    # this function is executed when a player writes a new message
    @socketio.on("new_message")
    def new_message(message, chat_id):
        chat = Chat.query.filter_by(id=chat_id).first()
        new_message = Message(
            text=message, 
            player_id=current_user.id, 
            chat_id=chat.id
        )
        db.session.add(new_message)
        db.session.commit()
        msg = f"<div>{current_user.username} : {message}</div>"
        engine.display_new_message(msg, chat.participants)

    # this function is executed when a player clicks on 'start construction'
    @socketio.on("start_construction")
    def start_construction(facility, family):
        assets = current_app.config["engine"].config[current_user.id]["assets"]
        if current_user.money < assets[facility]["price"]:
            current_user.emit("errorMessage", "Not enough money")
        else:
            current_user.money -= assets[facility]["price"]
            db.session.commit()
            updates = [("money", display_CHF(current_user.money))]
            engine.update_fields(updates, [current_user])
            finish_time = time.time() + assets[facility]["construction time"]
            heapq.heappush(heap, (finish_time, add_asset, (current_user.id, facility)))
            new_facility = Under_construction(
                name=facility,
                family=family,
                start_time=time.time(),
                finish_time=finish_time,
                player_id=session["ID"],
            )
            db.session.add(new_facility)
            db.session.commit()