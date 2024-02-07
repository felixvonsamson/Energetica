"""
I dumped all small helpful functions here
"""

import requests
import json
import math
import threading
import pickle
import os
import time
import numpy as np

from .rest_api import rest_notify_player_location
from .database import (
    Player,
    Network,
    Resource_on_sale,
    Shipment,
    Chat,
    Under_construction,
    Notification,
)
from . import db
from flask import current_app, flash


def flash_error(msg):
    return flash(msg, category="error")


def notify(title, message, players):
    """creates a new notification"""
    new_notification = Notification(
        title=title,
        content=message,
    )
    db.session.add(new_notification)
    for player in players:
        player.notifications.append(new_notification)
    db.session.commit()


# this function is executed after an asset is finished facility :
def add_asset(player_id, construction_id):
    player = Player.query.get(player_id)
    construction = Under_construction.query.get(construction_id)
    setattr(player, construction.name, getattr(player, construction.name) + 1)
    priority_list_name = "construction_priorities"
    if construction.family == "Technologies":
        priority_list_name = "research_priorities"
    player.remove_project_priority(priority_list_name, construction_id)
    construction_priorities = player.read_project_priority(
        "construction_priorities"
    )
    for id in construction_priorities:
        construction = Under_construction.query.get(id)
        if construction.suspension_time is not None:
            construction.start_time += (
                time.time() - construction.suspension_time
            )
            construction.suspension_time = None
            db.session.commit()
            break
    current_app.config["engine"].config.update_config_for_user(player.id)
    if construction.family == "Technologies":
        notify(
            "Constructions",
            f"The construction of the facility {construction.name} has finished.",
            [player],
        )
        print(
            f"{player.username} has finished the construction of facility {construction.name}"
        )
    else:
        notify(
            "Technologies",
            f"The research of the technology {construction.name} has finished.",
            [player],
        )
        print(
            f"{player.username} has finished the research of technology {construction.name}"
        )


# this function is executed when a resource shippment arrives :
def store_import(player, resource, quantity):
    max_cap = current_app.config["engine"].config[player.id][
        "warehouse_capacities"
    ][resource]
    if getattr(player, resource) + quantity > max_cap:
        setattr(player, resource, max_cap)
        # excess resources are stored in the ground
        setattr(
            player.tile,
            resource,
            getattr(player.tile, resource)
            + getattr(player, resource)
            + quantity
            - max_cap,
        )
        notify(
            "Shipments",
            f"A shipment of {format_mass(quantity)} {resource} arrived, but only {format_mass(max_cap - getattr(player, resource))} could be stored in your warehouse.",
            [player],
        )
        print(
            f"{player.username} received a shipment of {format_mass(quantity)} {resource}, but could only store {format_mass(max_cap - getattr(player, resource))} in their warehouse."
        )
    else:
        setattr(player, resource, getattr(player, resource) + quantity)
        notify(
            "Shipments",
            f"A shipment of {format_mass(quantity)} {resource} arrived.",
            [player],
        )
        print(
            f"{player.username} received a shipment of {format_mass(quantity)} {resource}."
        )


# format for price display
def display_money(price):
    return f"{price:,.0f}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>".replace(
        ",", "'"
    )


def format_mass(mass):
    """Formats mass in kg into a string with corresponding unit."""
    if mass < 50000:
        formatted_mass = f"{int(mass):,d}".replace(",", "'") + " kg"
    else:
        formatted_mass = f"{mass / 1000:,.0f}".replace(",", "'") + " t"
    return formatted_mass


# checks if a chat with exactly these participants already exists
def check_existing_chats(participants):
    participant_ids = [participant.id for participant in participants]
    conditions = [
        Chat.participants.any(id=participant_id)
        for participant_id in participant_ids
    ]
    existing_chats = Chat.query.filter(*conditions)
    for chat in existing_chats:
        if len(chat.participants) == len(participants):
            return True
    return False


# This function upddates the windspeed and irradiation data every 10 mminutes by using the meteosuisse api
def update_weather(engine):
    url_wind = "https://data.geo.admin.ch/ch.meteoschweiz.messwerte-windgeschwindigkeit-kmh-10min/ch.meteoschweiz.messwerte-windgeschwindigkeit-kmh-10min_en.json"
    url_irr = "https://data.geo.admin.ch/ch.meteoschweiz.messwerte-globalstrahlung-10min/ch.meteoschweiz.messwerte-globalstrahlung-10min_en.json"
    t = engine.data["current_t"]
    try:
        response = requests.get(url_wind)
        if response.status_code == 200:
            windspeed = json.loads(response.content)["features"][107][
                "properties"
            ]["value"]
            if windspeed > 2000:
                windspeed = engine.data["current_windspeed"][t - 1]
            interpolation = np.linspace(
                engine.data["current_windspeed"][t - 1], windspeed, 11
            )
            engine.data["current_windspeed"][t : t + 10] = interpolation[1:]
        else:
            print(
                "Failed to fetch the file. Status code:", response.status_code
            )
            engine.data["current_windspeed"][t : t + 10] = [
                engine.data["current_windspeed"][t - 1]
            ] * 10
    except Exception as e:
        print("An error occurred:", e)
        engine.data["current_windspeed"][t : t + 10] = [
            engine.data["current_windspeed"][t - 1]
        ] * 10

    try:
        response = requests.get(url_irr)
        if response.status_code == 200:
            irradiation = json.loads(response.content)["features"][65][
                "properties"
            ]["value"]
            if irradiation > 2000:
                irradiation = engine.data["current_irradiation"][t - 1]
            interpolation = np.linspace(
                engine.data["current_irradiation"][t - 1], irradiation, 11
            )
            engine.data["current_irradiation"][t : t + 10] = interpolation[1:]
        else:
            print(
                "Failed to fetch the file. Status code:", response.status_code
            )
            engine.data["current_irradiation"][t : t + 10] = [
                engine.data["current_irradiation"][t - 1]
            ] * 10
    except Exception as e:
        print("An error occurred:", e)
        engine.data["current_irradiation"][t : t + 10] = [
            engine.data["current_irradiation"][t - 1]
        ] * 10

    month = math.floor(
        (engine.data["total_t"] % 73440) / 6120
    )  # One year in game is 51 days
    f = (engine.data["total_t"] % 73440) / 6120 - month
    d = engine.river_discharge
    power_factor = d[month] + (d[(month + 1) % 12] - d[month]) * f
    engine.data["current_discharge"][t : t + 10] = [power_factor] * 10
    print(
        f"the current irradiation in Zürich is {engine.data['current_irradiation'][t+9]} W/m2 with a windspeed of {engine.data['current_windspeed'][t+9]} km/h"
    )


# saves the past production data to files every 24h AND remove network data older than 24h
def save_past_data_threaded(app, engine, new_data, network_data):
    def save_data():
        with app.app_context():
            players = Player.query.all()
            for player in players:
                past_data = {}
                for timescale in ["5_days", "month", "6_months"]:
                    with open(
                        f"instance/player_data/{player.id}/{timescale}.pck",
                        "rb",
                    ) as file:
                        past_data[timescale] = pickle.load(file)

                past_data["day"] = new_data[player.id]
                for category in past_data["5_days"]:
                    for element in past_data["5_days"][category]:
                        new_array = np.array(
                            new_data[player.id][category][element]
                        )
                        new_5_days = np.mean(new_array.reshape(-1, 5), axis=1)
                        past_data["5_days"][category][element] = past_data[
                            "5_days"
                        ][category][element][288:]
                        past_data["5_days"][category][element].extend(
                            new_5_days
                        )
                        new_month = np.mean(new_5_days.reshape(-1, 6), axis=1)
                        past_data["month"][category][element] = past_data[
                            "month"
                        ][category][element][48:]
                        past_data["month"][category][element].extend(new_month)
                        new_6_months = np.mean(new_month.reshape(-1, 6), axis=1)
                        past_data["6_months"][category][element] = past_data[
                            "6_months"
                        ][category][element][8:]
                        past_data["6_months"][category][element].extend(
                            new_6_months
                        )

                for timescale in past_data:
                    with open(
                        f"instance/player_data/{player.id}/{timescale}.pck",
                        "wb",
                    ) as file:
                        pickle.dump(past_data[timescale], file)

            # remove old network files AND save past prices
            networks = Network.query.all()
            for network in networks:
                network_dir = f"instance/network_data/{network.id}/charts/"
                files = os.listdir(network_dir)
                for filename in files:
                    t_value = int(
                        filename.split("market_t")[1].split(".pck")[0]
                    )
                    if t_value < engine.data["total_t"] - 1440:
                        os.remove(os.path.join(network_dir, filename))

                past_data = {}
                for timescale in ["5_days", "month", "6_months"]:
                    with open(
                        f"instance/network_data/{network.id}/prices/{timescale}.pck",
                        "rb",
                    ) as file:
                        past_data[timescale] = pickle.load(file)

                past_data["day"] = network_data[network.name]
                for element in past_data["5_days"]:
                    new_array = np.array(network_data[network.name][element])
                    new_5_days = np.mean(new_array.reshape(-1, 5), axis=1)
                    past_data["5_days"][element] = past_data["5_days"][element][
                        288:
                    ]
                    past_data["5_days"][element].extend(new_5_days)
                    new_month = np.mean(new_5_days.reshape(-1, 6), axis=1)
                    past_data["month"][element] = past_data["month"][element][
                        48:
                    ]
                    past_data["month"][element].extend(new_month)
                    new_6_months = np.mean(new_month.reshape(-1, 6), axis=1)
                    past_data["6_months"][element] = past_data["6_months"][
                        element
                    ][8:]
                    past_data["6_months"][element].extend(new_6_months)

                for timescale in past_data:
                    with open(
                        f"instance/network_data/{network.id}/prices/{timescale}.pck",
                        "wb",
                    ) as file:
                        pickle.dump(past_data[timescale], file)

            print("past 24h data has been saved to files")

    thread = threading.Thread(target=save_data)
    thread.start()


def data_init_network(length):
    return {
        "price": [0] * length,
        "quantity": [0] * length,
    }


def put_resource_on_market(player, resource, quantity, price):
    """Put an offer on the resource market"""
    if (
        getattr(player, resource) - getattr(player, resource + "_on_sale")
        < quantity
    ):
        flash_error(f"You have not enough {resource} available")
    else:
        setattr(
            player,
            resource + "_on_sale",
            getattr(player, resource + "_on_sale") + quantity,
        )
        new_sale = Resource_on_sale(
            resource=resource, quantity=quantity, price=price, player=player
        )
        db.session.add(new_sale)
        db.session.commit()
        flash(
            f"You put {quantity/1000}t of {resource} on sale for {price*1000}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>/t",
            category="message",
        )


def buy_resource_from_market(player, quantity, sale_id):
    """Buy an offer from the resource market"""
    sale = Resource_on_sale.query.filter_by(id=sale_id).first()
    total_price = sale.price * quantity
    if player == sale.player:
        # Player is buying their own resource
        if quantity == sale.quantity:
            Resource_on_sale.query.filter_by(id=sale_id).delete()
        else:
            sale.quantity -= quantity
        setattr(
            player,
            sale.resource + "_on_sale",
            getattr(player, sale.resource + "_on_sale") - quantity,
        )
        db.session.commit()
        flash(
            f"You removed {format_mass(quantity)} of {sale.resource} from the market",
            category="message",
        )
    elif total_price > player.money:
        flash_error("You have not enough money")
    else:
        # Player buys form another player
        sale.quantity -= quantity
        player.money -= total_price
        sale.player.money += total_price
        player.update_resources()
        sale.player.update_resources()
        setattr(
            sale.player,
            sale.resource,
            getattr(sale.player, sale.resource) - quantity,
        )
        setattr(
            sale.player,
            sale.resource + "_on_sale",
            getattr(sale.player, sale.resource + "_on_sale") - quantity,
        )
        dq = player.tile.q - sale.player.tile.q
        dr = player.tile.r - sale.player.tile.r
        distance = math.sqrt(2 * (dq**2 + dr**2 + dq * dr))
        shipment_duration = (
            distance * current_app.config["engine"].config["transport"]["time"]
        )
        new_shipment = Shipment(
            resource=sale.resource,
            quantity=quantity,
            departure_time=time.time(),
            duration=shipment_duration,
            player_id=player.id,
        )
        db.session.add(new_shipment)
        notify(
            "Resource transaction",
            f"{player} bougth {format_mass(quantity)} of {sale.resource} for a total cost of {display_money(total_price)}.",
            [sale.player],
        )
        flash(
            f"You bougth {format_mass(quantity)} of {sale.resource} from {sale.player} for a total cost of {display_money(total_price)}.",
            category="message",
        )
        print(
            f"{player} bougth {format_mass(quantity)} of {sale.resource} from {sale.player} for a total cost of {display_money(total_price)}."
        )
        if sale.quantity == 0:
            # Player is purchasing all available quantity
            Resource_on_sale.query.filter_by(id=sale_id).delete()
        db.session.commit()


def confirm_location(engine, player, location):
    """This function is calle when a player choses a location. It returns either
    success or an explanatory error message in the form of a dictionary.
    It is called when a web client uses the choose_location socket.io endpoint,
    or the REST websocket API."""
    if location.player_id is not None:
        # Location already taken
        return {"response": "locationOccupied", "by": location.player_id}
    if player.tile is not None:
        # Player has already chosen a location and cannot chose again
        return {"response": "choiceUnmodifiable"}
    # Checks have succeeded, proceed
    location.player_id = player.id
    db.session.commit()
    rest_notify_player_location(engine, player)
    print(f"{player.username} chose the location {location.id}")
    return {"response": "success"}


def set_network_prices(engine, player, prices, SCPs):
    """this function is executed when a player changes the value the enegy selling prices"""

    def sort_priority(priority_list, prefix="price_"):
        return sorted(priority_list, key=lambda x: getattr(player, prefix + x))

    SCP_list = []
    rest_list = []
    demand_list = player.demand_priorities.split(" ")

    for SCP in SCPs:
        facility = SCP[4:]
        if SCPs[SCP]:
            SCP_list.append(facility)
        else:
            rest_list.append(facility)

    for price in prices:
        setattr(player, price, prices[price])

    rest_list = sort_priority(rest_list)
    SCP_list = engine.renewables + sort_priority(SCP_list)
    demand_list = sort_priority(demand_list, prefix="price_buy_")
    demand_list.reverse()

    print(f"{player.username} updated their prices")

    space = " "
    player.self_consumption_priority = space.join(SCP_list)
    player.rest_of_priorities = space.join(rest_list)
    player.demand_priorities = space.join(demand_list)
    db.session.commit()


def start_project(player, facility, family):
    """this function is executed when a player clicks on 'start construction'"""
    assets = current_app.config["engine"].config[player.id]["assets"]

    if assets[facility]["locked"]:
        return {"response": "locked"}

    if facility in ["small_water_dam", "large_water_dam", "watermill"]:
        ud = Under_construction.query.filter_by(
            name=facility, player_id=player.id
        ).count()
        if player.tile.hydro <= getattr(player, facility) + ud:
            return {"response": "noSuitableLocationAvailable"}

    if family in ["Functional facilities", "Technologies"]:
        ud_count = Under_construction.query.filter_by(
            name=facility, player_id=player.id
        ).count()
        real_price = (
            assets[facility]["price"]
            * assets[facility]["price multiplier"] ** ud_count
        )
        duration = (
            assets[facility]["construction time"]
            * assets[facility]["price multiplier"] ** ud_count
        )
    else:  # power facitlies, storage facilities, extractions facilities
        real_price = assets[facility]["price"]
        duration = assets[facility]["construction time"]

    if player.money < real_price:
        return {"response": "notEnoughMoneyError"}

    priority_list_name = "construction_priorities"
    suspension_time = time.time()
    if family == "Technologies":
        priority_list_name = "research_priorities"
        if player.available_lab_workers() > 0:
            suspension_time = None
    else:
        if player.available_construction_workers() > 0:
            suspension_time = None

    player.money -= real_price
    new_construction = Under_construction(
        name=facility,
        family=family,
        start_time=time.time(),
        duration=duration,
        suspension_time=suspension_time,
        original_price=real_price,
        player_id=player.id,
    )
    db.session.add(new_construction)
    db.session.commit()
    print(f"{player.username} started the construction {facility}")
    player.add_project_priority(priority_list_name, new_construction.id)
    if suspension_time is None:
        player.project_max_priority(priority_list_name, new_construction.id)
    return {
        "response": "success",
        "money": player.money,
        "constructions": get_construction_data(player),
    }


def cancel_project(player, construction_id):
    """this function is executed when a player cancels an ongoing construction"""
    construction = Under_construction.query.get(int(construction_id))

    priority_list_name = "construction_priorities"
    if construction.family == "Technologies":
        priority_list_name = "research_priorities"

    if construction.suspension_time is None:
        time_fraction = (time.time() - construction.start_time) / (
            construction.duration
        )
    else:
        time_fraction = (
            construction.suspension_time - construction.start_time
        ) / (construction.duration)

    refund = 0.8 * construction.original_price * (1 - time_fraction)
    player.money += refund
    db.session.delete(construction)
    db.session.commit()
    print(f"{player.username} cancelled the construction {construction.name}")
    player.remove_project_priority(priority_list_name, construction_id)
    return {
        "response": "success",
        "money": player.money,
        "constructions": get_construction_data(player),
    }


def pause_project(player, construction_id):
    """this function is executed when a player pauses or unpauses an ongoing construction"""
    construction = Under_construction.query.get(int(construction_id))

    if construction.suspension_time is None:
        construction.suspension_time = time.time()
    else:
        if construction.family == "Technologies":
            player.project_max_priority(
                "research_priorities", int(construction_id)
            )
            if player.available_lab_workers() == 0:
                research_priorities = player.read_project_priority(
                    "research_priorities"
                )
                project_to_pause = Under_construction.query.get(
                    research_priorities[player.lab_workers]
                )
                project_to_pause.suspension_time = time.time()
        else:
            player.project_max_priority(
                "construction_priorities", int(construction_id)
            )
            if player.available_construction_workers() == 0:
                construction_priorities = player.read_project_priority(
                    "construction_priorities"
                )
                project_to_pause = Under_construction.query.get(
                    construction_priorities[player.construction_workers]
                )
                project_to_pause.suspension_time = time.time()
        construction.start_time += time.time() - construction.suspension_time
        construction.suspension_time = None
    db.session.commit()
    return {
        "response": "success",
        "constructions": get_construction_data(player),
    }


def increase_project_priority(player, construction_id):
    """this function is executed when a player changes the order of ongoing constructions"""
    construction = Under_construction.query.get(int(construction_id))

    if construction.family == "Technologies":
        player.increase_project_priority(
            "research_priorities", int(construction_id)
        )
    else:
        player.increase_project_priority(
            "construction_priorities", int(construction_id)
        )

    return {
        "response": "success",
        "constructions": get_construction_data(player),
    }


def get_construction_data(player):
    projects = player.get_constructions()
    construction_priorities = player.read_project_priority(
        "construction_priorities"
    )
    research_priorities = player.read_project_priority("research_priorities")
    return {0: projects, 1: construction_priorities, 2: research_priorities}
