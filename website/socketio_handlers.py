"""
This code contains the main functions that communicate with the server (server side)
"""

import time
import heapq
from flask import request, session, flash, g, current_app
from flask_login import current_user
from . import heap
from .database import Player, Network, Hex, Under_construction, Chat, Message
from .utils import add_asset, display_CHF, check_existing_chats
from . import db
from pathlib import Path

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
        elif len(current_user.tile) != 0:
            current_user.emit("errorMessage", "You already chose a location. Please refresh")
        else:
            location.player_id = current_user.id
            db.session.commit()
            engine.refresh()
            print(f"{current_user.username} chose the location {location.id}")

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
        print(f"{current_user.username} created a group chat called {title} with {group}")

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
        print(f"{current_user.username} sent the message {message} in the chat {chat.name}")

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
            current_user.emit("display_under_construction", (facility, finish_time))
            print(f"{current_user.username} started the construction {facility}")

    # this function is executed when a player creates a network
    @socketio.on("create_network")
    def create_network(network_name, invitations):
        for username in invitations:
            player = Player.query.filter_by(username=username).first()
            # INVITE PLAYERS TO JOIN NETWORK
        if Network.query.filter_by(name=network_name).first() is not None:
            current_user.emit("errorMessage", "Network with this name already exists")
            return
        new_Network = Network(name=network_name, members=[current_user])
        db.session.add(new_Network)
        db.session.commit()
        engine.refresh()
        Path(f"instance/network_data/{network_name}").mkdir(parents=True, exist_ok=True)
        print(f"{current_user.username} created the network {network_name}")

    # this function is executed when a player changes the value the enegy selling prices
    @socketio.on("change_price")
    def change_price(attribute, value):
        def reorder(priority_list, asset):
            for i, a in enumerate(priority_list):
                if getattr(current_user, "price_"+a) >= getattr(current_user, "price_"+asset):
                    priority_list.insert(i, asset)
                    return priority_list
            priority_list.append(asset)
            return priority_list
        
        SCP_list = current_user.self_consumption_priority.split(' ')
        rest_list = current_user.rest_of_priorities.split(' ')
        
        # add or remove to SCP and order 
        if "SCP" in attribute:
            asset = attribute[4:]
            if value == True:
                rest_list.remove(asset)
                SCP_list = reorder(SCP_list, asset)
                print(f"{current_user.username} added {asset} to his SCP list")
            else:
                SCP_list.remove(asset)
                rest_list = reorder(rest_list, asset)
                print(f"{current_user.username} removed {asset} from his SCP list")
            
        else:
            setattr(current_user, attribute, float(value))
            # reorder priority lists if production plant
            if "sell" not in attribute and "buy" not in attribute:
                asset = attribute[6:]
                if asset in SCP_list:
                    SCP_list.remove(asset)
                    SCP_list = reorder(SCP_list, asset)
                else :
                    rest_list.remove(asset)
                    rest_list = reorder(rest_list, asset)
            print(f"{current_user.username} changed the price of {attribute} to {value}")

        space = " "
        current_user.self_consumption_priority = space.join(SCP_list)
        current_user.rest_of_priorities = space.join(rest_list)
        db.session.commit()