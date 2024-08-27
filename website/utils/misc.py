"""Miscellaneous util functions"""

import math
import os
import pickle
import threading
from datetime import datetime, timedelta

import numpy as np
from flask import flash

import website.api.websocket as websocket
from website import db
from website.database.engine_data import CapacityData, CircularBufferPlayer, CumulativeEmissionsData
from website.database.messages import Chat, Notification
from website.database.player import Network, Player
from website.database.player_assets import ActiveFacility

# Helper functions and data initialization utilities


def flash_error(msg):
    """Helper function to flash an error message"""
    return flash(msg, category="error")


def data_init():
    """Initializes the data structure for a new player"""

    def init_array():
        return [[0.0] * 360] * 5

    return {
        "revenues": {
            "industry": init_array(),
            "exports": init_array(),
            "imports": init_array(),
            "dumping": init_array(),
            "climate_events": init_array(),
        },
        "op_costs": {
            "steam_engine": init_array(),
        },
        "generation": {
            "steam_engine": init_array(),
            "imports": init_array(),
        },
        "demand": {
            "industry": init_array(),
            "construction": init_array(),
            "research": init_array(),
            "transport": init_array(),
            "exports": init_array(),
            "dumping": init_array(),
        },
        "storage": {},
        "resources": {},
        "emissions": {
            "steam_engine": init_array(),
            "construction": init_array(),
        },
    }


def init_table(user_id):
    """initialize data table for new user and stores it as a .pck in the 'player_data' repo"""
    past_data = data_init()
    with open(f"instance/player_data/player_{user_id}.pck", "wb") as file:
        pickle.dump(past_data, file)


def add_player_to_data(engine, user):
    """Helper function to add a new player to the engine data"""
    engine.data["current_data"][user.id] = CircularBufferPlayer()
    engine.data["player_capacities"][user.id] = CapacityData()
    engine.data["player_cumul_emissions"][user.id] = CumulativeEmissionsData()
    engine.data["player_capacities"][user.id].update(user, None)


def save_past_data_threaded(app, engine):
    """Saves the past production data to files every 216 ticks AND remove network
    data older than 24h
    """

    def save_data():
        with app.app_context():
            # save climate data
            with open("instance/server_data/climate_data.pck", "rb") as file:
                past_climate_data = pickle.load(file)
            new_climate_data = engine.data["current_climate_data"].get_data()
            for category in new_climate_data:
                for element in new_climate_data[category]:
                    new_el_data = new_climate_data[category][element]
                    past_el_data = past_climate_data[category][element]
                    reduce_resolution(past_el_data, np.array(new_el_data))
            with open("instance/server_data/climate_data.pck", "wb") as file:
                pickle.dump(past_climate_data, file)

            # save player data
            players = Player.query.all()
            for player in players:
                if player.tile is None:
                    continue
                past_data = {}
                with open(
                    f"instance/player_data/player_{player.id}.pck",
                    "rb",
                ) as file:
                    past_data = pickle.load(file)
                new_data = engine.data["current_data"][player.id].get_data()
                for category in new_data:
                    for element in new_data[category]:
                        new_el_data = new_data[category][element]
                        if element not in past_data[category]:
                            # if facility didn't exist in past data, initialize it
                            past_data[category][element] = [[0.0] * 360] * 5
                        past_el_data = past_data[category][element]
                        reduce_resolution(past_el_data, np.array(new_el_data))

                with open(
                    f"instance/player_data/player_{player.id}.pck",
                    "wb",
                ) as file:
                    pickle.dump(past_data, file)

            # remove old network files AND save past prices
            networks = Network.query.all()
            for network in networks:
                network_dir = f"instance/network_data/{network.id}/charts/"
                files = os.listdir(network_dir)
                for filename in files:
                    t_value = int(filename.split("market_t")[1].split(".pck")[0])
                    if t_value < engine.data["total_t"] - 1440:
                        os.remove(os.path.join(network_dir, filename))

                past_data = {}
                with open(
                    f"instance/network_data/{network.id}/time_series.pck",
                    "rb",
                ) as file:
                    past_data = pickle.load(file)

                new_data = engine.data["network_data"][network.id].get_data()
                for category in new_data:
                    for group, buffer in new_data[category].items():
                        if group not in past_data[category]:
                            past_data[category][group] = [[0.0] * 360] * 5
                        past_el_data = past_data[category][group]
                        reduce_resolution(past_el_data, np.array(buffer))

                with open(
                    f"instance/network_data/{network.id}/time_series.pck",
                    "wb",
                ) as file:
                    pickle.dump(past_data, file)

            # remove old notifications
            Notification.query.filter(
                Notification.title != "Tutorial",
                Notification.time < datetime.now() - timedelta(weeks=2),
            ).delete()
            db.session.commit()

            engine.log("last 216 data points have been saved to files")

    def reduce_resolution(array, new_values):
        """reduces resolution of current array x6, x36, x216 and x1296"""
        array[0] = array[0][len(new_values) :]
        array[0].extend(new_values)
        new_values_reduced = new_values
        for r in range(1, 4):
            new_values_reduced = np.mean(new_values_reduced.reshape(-1, 6), axis=1)
            array[r] = array[r][len(new_values_reduced) :]
            array[r].extend(new_values_reduced)
        if engine.data["total_t"] % 1296 == 0:
            array[4] = array[4][1:]
            array[4].append(np.mean(array[3][-6:]))

    thread = threading.Thread(target=save_data)
    thread.start()


def display_new_message(engine, message, chat):
    """Sends chat message to all relevant sources through socketio and websocket"""
    websocket_message = websocket.rest_new_chat_message(chat.id, message)
    for player in chat.participants:
        player.emit(
            "display_new_message",
            {
                "time": message.time.isoformat(),
                "player_id": message.player_id,
                "text": message.text,
                "chat_id": message.chat_id,
            },
        )
        websocket.rest_notify_player(engine, player, websocket_message)


# Map


def confirm_location(engine, player, location):
    """
    This function is called when a player choses a location. It returns
    either success or an explanatory error message in the form of a dictionary.
    It is called when a web client uses the choose_location socket.io endpoint,
    or the REST websocket API.
    """
    if location.player_id is not None:
        # Location already taken
        return {"response": "locationOccupied", "by": location.player_id}
    if player.tile is not None:
        # Player has already chosen a location and cannot chose again
        return {"response": "choiceUnmodifiable"}
    # Checks have succeeded, proceed
    location.player_id = player.id
    eol = engine.data["total_t"] + math.ceil(
        engine.const_config["assets"]["steam_engine"]["lifespan"] / engine.in_game_seconds_per_tick
    )
    steam_engine: ActiveFacility = ActiveFacility(
        facility="steam_engine",
        pos_x=player.tile.q + 0.5 * player.tile.r,
        pos_y=player.tile.r,
        end_of_life=eol,
        player_id=player.id,
        price_multiplier=1.0,
        multiplier_1=1.0,
        multiplier_2=1.0,
        multiplier_3=1.0,
    )
    db.session.add(steam_engine)
    general_chat = Chat.query.get(1)
    player.chats.append(general_chat)
    db.session.commit()
    engine.data["current_data"][player.id].new_subcategory("op_costs", "steam_engine")
    engine.data["current_data"][player.id].new_subcategory("generation", "steam_engine")
    engine.data["current_data"][player.id].new_subcategory("emissions", "steam_engine")
    add_player_to_data(engine, player)
    init_table(player.id)
    websocket.rest_notify_player_location(engine, player)
    engine.log(f"{player.username} chose the location {location.id}")
    return {"response": "success"}


# Quiz


def submit_quiz_answer(engine, player, answer):
    """
    This function is called when a player submits an answer to a quiz question.
    It returns the new data for the quiz question in the form of a dictionary.
    """
    quiz_data = engine.data["daily_question"]
    if player.id in quiz_data["player_answers"]:
        return {"response": "quizAlreadyAnswered"}
    quiz_data["player_answers"][player.id] = answer
    if answer == quiz_data["answer"] or quiz_data["answer"] == "all correct":
        player.xp += 1
        db.session.commit()
        engine.log(f"{player.username} answered the quiz correctly")
        return {"response": "correct", "question_data": get_quiz_question(engine, player)}
    engine.log(f"{player.username} answered the quiz incorrectly")
    return {"response": "incorrect", "question_data": get_quiz_question(engine, player)}


def get_quiz_question(engine, player):
    """
    This function returns the data for the quiz question in the form of a dictionary with only the answer of the
    current player.
    """
    question_data = engine.data["daily_question"].copy()
    if player.id in question_data["player_answers"]:
        question_data["player_answer"] = question_data["player_answers"][player.id]
    del question_data["player_answers"]
    return question_data
