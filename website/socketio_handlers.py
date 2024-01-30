"""
This code contains the main functions that communicate with the server (server side)
"""

from flask import request
from flask_login import current_user
from .database import Player, Chat, Message
from .utils import check_existing_chats
from . import db


def add_handlers(socketio, engine):
    # ???
    @socketio.on("give_identity")
    def give_identity():
        player = current_user
        player.sid = request.sid
        db.session.commit()

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
        print(
            f"{current_user.username} created a group chat called {title} with {group}"
        )

    # this function is executed when a player writes a new message
    @socketio.on("new_message")
    def new_message(message, chat_id):
        chat = Chat.query.filter_by(id=chat_id).first()
        new_message = Message(
            text=message, player_id=current_user.id, chat_id=chat.id
        )
        db.session.add(new_message)
        db.session.commit()
        msg = f"<div>{current_user.username} : {message}</div>"
        engine.display_new_message(msg, chat.participants)
        print(
            f"{current_user.username} sent the message {message} in the chat {chat.name}"
        )
