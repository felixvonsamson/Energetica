"""
This code contains the main functions that communicate with the server (server side)
"""

import time
import pickle
from flask import request, flash, g, current_app
from flask_login import current_user
from .database import Player, Network, Hex, Under_construction, Chat, Message
from .utils import display_money, check_existing_chats, data_init_network
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
            current_user.emit(
                "errorMessage", "You already chose a location. Please refresh"
            )
        else:
            location.player_id = current_user.id
            db.session.commit()
            rest_notify_player_location(player)
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
        print(
            f"{current_user.username} created a group chat called {title} with {group}"
        )

    # this function is executed when a player writes a new message
    @socketio.on("new_message")
    def new_message(message, chat_id):
        chat = Chat.query.filter_by(id=chat_id).first()
        new_message = Message(text=message, player_id=current_user.id, chat_id=chat.id)
        db.session.add(new_message)
        db.session.commit()
        msg = f"<div>{current_user.username} : {message}</div>"
        engine.display_new_message(msg, chat.participants)
        print(
            f"{current_user.username} sent the message {message} in the chat {chat.name}"
        )

    # this function is executed when a player clicks on 'start construction'
    @socketio.on("start_construction")
    def start_construction(facility, family):
        assets = current_app.config["engine"].config[current_user.id]["assets"]
        if current_user.money < assets[facility]["price"]:
            current_user.emit("errorMessage", "Not enough money")
            return
        if facility in ["small_water_dam", "large_water_dam", "watermill"]:
            ud = Under_construction.query.filter_by(name=facility).count()
            if current_user.tile[0].hydro <= getattr(current_user, facility) + ud:
                current_user.emit("errorMessage", "No suitable location available")
                return
        if family in ["functional_facilities", "technologies"]:
            ud_count = Under_construction.query.filter_by(
                name=facility, player_id=current_user.id
            ).count()
            real_price = (
                assets[facility]["price"]
                * assets[facility]["price multiplier"] ** ud_count
            )
            if current_user.money < real_price:
                current_user.emit(
                    "errorMessage", "Not enough money to queue this upgrade"
                )
                return
            current_user.money -= real_price
            duration = (
                assets[facility]["construction time"]
                * assets[facility]["price multiplier"] ** ud_count
            )
            if family == "functional_facilities":
                start_time = (
                    None if current_user.construction_workers == 0 else time.time()
                )
            else:
                start_time = None if current_user.lab_workers == 0 else time.time()
        else:  # power facitlies, storage facilities, extractions facilities
            current_user.money -= assets[facility]["price"]
            duration = assets[facility]["construction time"]
            start_time = None if current_user.construction_workers == 0 else time.time()
        updates = [("money", display_money(current_user.money))]
        engine.update_fields(updates, [current_user])
        new_facility = Under_construction(
            name=facility,
            family=family,
            start_time=start_time,
            duration=duration,
            player_id=current_user.id,
        )
        db.session.add(new_facility)
        db.session.commit()
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
        Path(f"instance/network_data/{network_name}/charts").mkdir(
            parents=True, exist_ok=True
        )
        engine.data["network_data"][network_name] = data_init_network(1441)
        past_data = data_init_network(1440)
        Path(f"instance/network_data/{network_name}/prices").mkdir(
            parents=True, exist_ok=True
        )
        for timescale in ["day", "5_days", "month", "6_months"]:
            with open(
                f"instance/network_data/{network_name}/prices/{timescale}.pck", "wb"
            ) as file:
                pickle.dump(past_data, file)
        print(f"{current_user.username} created the network {network_name}")

    # this function is executed when a player leaves his network
    @socketio.on("leave_network")
    def leave_network():
        network_id = current_user.network_id
        print(f"{current_user.username} left the network {current_user.network.name}")
        current_user.network_id = None
        remaining_members_count = Player.query.filter_by(network_id=network_id).count()
        # delete network if it is empty
        if remaining_members_count == 0:
            network = Network.query.filter_by(id=network_id).first()
            print(f"The network {network.name} has been deleted because it was empty")
            db.session.delete(network)
        db.session.commit()
        engine.refresh()

    # this function is executed when a player changes the value the enegy selling prices
    @socketio.on("change_price")
    def change_price(prices, SCPs):
        def sort_priority(priority_list, prefix="price_"):
            return sorted(
                priority_list, key=lambda x: getattr(current_user, prefix + x)
            )

        SCP_list = []
        rest_list = []
        demand_list = current_user.demand_priorities.split(" ")

        for SCP in SCPs:
            facility = SCP[4:]
            if SCPs[SCP]:
                SCP_list.append(facility)
            else:
                rest_list.append(facility)

        for price in prices:
            setattr(current_user, price, prices[price])
        db.session.commit()

        rest_list = sort_priority(rest_list)
        SCP_list = engine.renewables + sort_priority(SCP_list)
        demand_list = sort_priority(demand_list, prefix="price_buy_")
        demand_list.reverse()

        print(f"{current_user.username} updated his prices")

        space = " "
        current_user.self_consumption_priority = space.join(SCP_list)
        current_user.rest_of_priorities = space.join(rest_list)
        current_user.demand_priorities = space.join(demand_list)
        db.session.commit()

        current_user.emit("infoMessage", "Changes saved")
