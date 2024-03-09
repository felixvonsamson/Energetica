"""
This code contains the main functions that communicate with the server (server side)
"""

from flask import request
from flask_login import current_user
from ..database.database import Player, Chat, Message
from ..utils import check_existing_chats
from .. import db
from datetime import datetime


def add_handlers(socketio, engine):
    @socketio.on("connect")
    def handle_connect():
        db.session.commit()
        # Store client's sid when connected
        if current_user.id not in engine.clients:
            engine.clients[current_user.id] = []
        engine.clients[current_user.id].append(request.sid)

    @socketio.on("disconnect")
    def handle_disconnect():
        # Remove client's sid when disconnected
        engine.clients[current_user.id].remove(request.sid)

    # this function is executed when a player creates a new group chat
    @socketio.on("create_group_chat")
    def create_group_chat(title, group):
        groupMembers = [current_user]
        for username in group:
            groupMembers.append(
                Player.query.filter_by(username=username).first()
            )
        if check_existing_chats(groupMembers):
            current_user.emit("errorMessage", "Chat already exists")
            return
        new_chat = Chat(name=title, participants=groupMembers)
        db.session.add(new_chat)
        db.session.commit()
        engine.refresh()
        engine.log(
            f"{current_user.username} created a group chat called {title} with {group}"
        )

    # this function is executed when a player writes a new message
    @socketio.on("new_message")
    def new_message(message, chat_id):
        chat = Chat.query.filter_by(id=chat_id).first()
        new_message = Message(
            text=message,
            time=datetime.now(),
            player_id=current_user.id,
            chat_id=chat.id,
        )
        db.session.add(new_message)
        db.session.commit()
        msg = f"<div>{current_user.username} : {message}</div>"
        engine.display_new_message(msg, chat.participants)
        engine.log(
            f"{current_user.username} sent the message {message} in the chat {chat.name}"
        )
