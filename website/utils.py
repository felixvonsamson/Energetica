"""
I dumped all small helpful functions here
"""

import math
import threading
import pickle
import os
import time
import numpy as np
import shutil
from datetime import datetime
from pathlib import Path
import requests
import json


from website.api import ws
from .database.engine_data import CircularBufferNetwork, CircularBufferPlayer
from .database.messages import Chat, Notification
from .database.player import Network, Player
from .database.player_assets import (
    Resource_on_sale,
    Shipment,
    Under_construction,
    Active_facilites,
)
from . import db
from flask import current_app, flash


def flash_error(msg):
    return flash(msg, category="error")


def notify(title, message, players):
    """creates a new notification"""
    new_notification = Notification(
        title=title, content=message, time=datetime.now()
    )
    db.session.add(new_notification)
    for player in players:
        player.notifications.append(new_notification)
        player.emit(
            "new_notification",
            {
                "id": new_notification.id,
                "time": str(new_notification.time),
                "title": new_notification.title,
                "content": new_notification.content,
            },
        )
    db.session.commit()


def add_asset(player_id, construction_id):
    """this function is executed when a construction of research project has finished"""
    engine = current_app.config["engine"]
    assets = engine.config[player_id]["assets"]
    player = Player.query.get(player_id)
    construction = Under_construction.query.get(construction_id)
    if getattr(player, construction.name) == 0:
        # initialize array for facility if it is the first one built
        current_data = engine.data["current_data"][player.id]
        if (
            construction.name
            in engine.storage_facilities
            + engine.controllable_facilities
            + engine.renewables
            + engine.extraction_facilities
        ):
            current_data.new_subcategory("op_costs", construction.name)
        if (
            construction.name
            in engine.storage_facilities
            + engine.controllable_facilities
            + engine.renewables
        ):
            current_data.new_subcategory("generation", construction.name)
        if (
            construction.name
            in engine.storage_facilities
            + engine.extraction_facilities
            + ["carbon_capture"]
        ):
            current_data.new_subcategory("demand", construction.name)
        if construction.name in engine.storage_facilities:
            current_data.new_subcategory("storage", construction.name)
        if (
            construction.name
            in engine.controllable_facilities
            + engine.extraction_facilities
            + ["carbon_capture"]
        ):
            current_data.new_subcategory("emissions", construction.name)
        if construction.name == "warehouse":
            for resource in ["coal", "oil", "gas", "uranium"]:
                current_data.new_subcategory("resources", resource)
        if construction.name in engine.extraction_facilities + [
            "carbon_capture"
        ]:
            player.add_project_priority("demand_priorities", construction.name)
            set_network_prices(engine, player)
        if construction.name in engine.renewables:
            player.add_project_priority(
                "self_consumption_priority", construction.name
            )
            set_network_prices(engine, player)
        if (
            construction.name
            in engine.storage_facilities + engine.controllable_facilities
        ):
            player.add_project_priority("rest_of_priorities", construction.name)
            set_network_prices(engine, player)
    setattr(player, construction.name, getattr(player, construction.name) + 1)
    priority_list_name = "construction_priorities"
    if construction.family == "Technologies":
        priority_list_name = "research_priorities"
    player.remove_project_priority(priority_list_name, construction_id)
    project_priorities = player.read_project_priority(priority_list_name)
    for id in project_priorities:
        next_construction = Under_construction.query.get(id)
        if next_construction is None:
            print(
                f"DATABASE MISMATCH : CONSTRUCTION {id} OF PLAYER {player.username} DOES NOT EXIST IN UNDER_CONSTRUCTION DATABASE !!!"
            )
        if next_construction.suspension_time is not None:
            next_construction.start_time += (
                time.time() - next_construction.suspension_time
            )
            next_construction.suspension_time = None
            db.session.commit()
            break
    if construction.family == "Technologies":
        server_tech = engine.data["technology_lvls"][construction.name]
        if len(server_tech) <= getattr(player, construction.name):
            server_tech.append(0)
        server_tech[getattr(player, construction.name) - 1] += 1
        notify(
            "Technologies",
            f"The research of the technology {engine.const_config[construction.name]['name']} has finished.",
            [player],
        )
        engine.log(
            f"{player.username} has finished the research of technology {engine.const_config[construction.name]['name']}"
        )
    else:
        notify(
            "Constructions",
            f"The construction of the facility {engine.const_config[construction.name]['name']} has finished.",
            [player],
        )
        engine.log(
            f"{player.username} has finished the construction of facility {engine.const_config[construction.name]['name']}"
        )
    if construction.family in [
        "Extraction facilities",
        "Power facilities",
        "Storage facilities",
    ]:
        new_facility = Active_facilites(
            facility=construction.name,
            end_of_life=time.time() + assets[construction.name]["lifetime"],
            player_id=player.id,
        )
        db.session.add(new_facility)
        db.session.commit()
    engine.config.update_config_for_user(player.id)


def remove_asset(player_id, facility, decommissioning=True):
    """this function is executed when a facility is decomissioned"""
    engine = current_app.config["engine"]
    assets = engine.config[player_id]["assets"]
    player = Player.query.get(player_id)
    setattr(player, facility, getattr(player, facility) - 1)
    # The cost of decommissioning is 20% of the building cost.
    cost = 0.2 * assets[facility]["price"]
    player.money -= cost
    if decommissioning:
        notify(
            "Decommissioning",
            f"The facility {engine.const_config[facility]['name']} reached the end of its operational lifespan and had to be decommissioned. The cost of this operation was {round(cost)}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>.",
            [player],
        )
    engine.log(
        f"The facility {engine.const_config[facility]['name']} from {player.username} has been decommissioned."
    )


def store_import(player, resource, quantity):
    """This function is executed when a resource shippment arrives"""
    engine = current_app.config["engine"]
    max_cap = engine.config[player.id]["warehouse_capacities"][resource]
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
        engine.log(
            f"{player.username} received a shipment of {format_mass(quantity)} {resource}, but could only store {format_mass(max_cap - getattr(player, resource))} in their warehouse."
        )
    else:
        setattr(player, resource, getattr(player, resource) + quantity)
        notify(
            "Shipments",
            f"A shipment of {format_mass(quantity)} {resource} arrived.",
            [player],
        )
        engine.log(
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
            engine.log(
                "Failed to fetch the file. Status code:", response.status_code
            )
            engine.data["current_windspeed"][t : t + 10] = [
                engine.data["current_windspeed"][t - 1]
            ] * 10
    except Exception as e:
        engine.log(e)
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
            engine.log(
                "Failed to fetch the file. Status code:", response.status_code
            )
            engine.data["current_irradiation"][t : t + 10] = [
                engine.data["current_irradiation"][t - 1]
            ] * 10
    except Exception as e:
        engine.log("An error occurred:" + str(e))
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
    engine.log(
        f"the current irradiation in Zürich is {engine.data['current_irradiation'][t+9]} W/m2 with a windspeed of {engine.data['current_windspeed'][t+9]} km/h"
    )


def save_past_data_threaded(app, engine):
    """Saves the past production data to files every hour AND remove network data older than 24h"""

    def save_data():
        with app.app_context():
            engine.config.update_mining_productivity()
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
                            past_data[category][element] = [[0.0] * 1440] * 4
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
                    t_value = int(
                        filename.split("market_t")[1].split(".pck")[0]
                    )
                    if t_value < engine.data["total_t"] - 1440:
                        os.remove(os.path.join(network_dir, filename))

                past_data = {}
                with open(
                    f"instance/network_data/{network.id}/time_series.pck",
                    "rb",
                ) as file:
                    past_data = pickle.load(file)

                new_data = engine.data["network_data"][network.id].get_data()
                for element in new_data:
                    new_el_data = new_data[element]
                    past_el_data = past_data[element]
                    reduce_resolution(past_el_data, np.array(new_el_data))

                with open(
                    f"instance/network_data/{network.id}/time_series.pck",
                    "wb",
                ) as file:
                    pickle.dump(past_data, file)

            engine.log("past hour data has been saved to files")

    def reduce_resolution(array, new_day):
        """reduces resolution of new day data to 5min, 30min, and 3h"""
        array[0] = array[0][len(new_day) :]
        array[0].extend(new_day)
        new_5_days = np.mean(new_day.reshape(-1, 5), axis=1)
        array[1] = array[1][len(new_5_days) :]
        array[1].extend(new_5_days)
        new_month = np.mean(new_5_days.reshape(-1, 6), axis=1)
        array[2] = array[2][len(new_month) :]
        array[2].extend(new_month)
        if engine.data["total_t"] % 180 == 0:
            array[3] = array[3][1:]
            array[3].append(np.mean(array[2][-6:]))

    thread = threading.Thread(target=save_data)
    thread.start()


def data_init_network():
    return {
        "price": [[0.0] * 1440] * 4,
        "quantity": [[0.0] * 1440] * 4,
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
            resource=resource,
            quantity=quantity,
            price=price,
            creation_date=datetime.now(),
            player=player,
        )
        db.session.add(new_sale)
        db.session.commit()
        flash(
            f"You put {quantity/1000}t of {resource} on sale for {price*1000}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>/t",
            category="message",
        )


def buy_resource_from_market(player, quantity, sale_id):
    """Buy an offer from the resource market"""
    engine = current_app.config["engine"]
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
            distance * engine.config[player.id]["transport"]["time"]
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
        engine.log(
            f"{player} bougth {format_mass(quantity)} of {sale.resource} from {sale.player} for a total cost of {display_money(total_price)}."
        )
        if sale.quantity == 0:
            # Player is purchasing all available quantity
            Resource_on_sale.query.filter_by(id=sale_id).delete()
        db.session.commit()


def confirm_location(engine, player, location):
    """This function is called when a player choses a location. It returns
    either success or an explanatory error message in the form of a dictionary.
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
    add_player_to_data(engine, player.id)
    init_table(player.id)
    db.session.commit()
    ws.rest_notify_player_location(engine, player)
    engine.log(f"{player.username} chose the location {location.id}")
    return {"response": "success"}


# initialize data table for new user and stores it as a .pck in the 'player_data' repo
def init_table(user_id):
    past_data = data_init()
    with open(f"instance/player_data/player_{user_id}.pck", "wb") as file:
        pickle.dump(past_data, file)


def add_player_to_data(engine, user_id):
    engine.data["current_data"][user_id] = CircularBufferPlayer()


def data_init():
    def init_array():
        return [[0.0] * 1440] * 4

    return {
        "revenues": {
            "industry": init_array(),
            "exports": init_array(),
            "imports": init_array(),
            "dumping": init_array(),
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


def join_network(engine, player, network):
    """shared API method to join a network."""
    if network is None:
        # print("utils.join_network: argument network was `None`")
        return {"response": "noSuchNetwork"}
    if player.network is not None:
        # print("utils.join_network: argument network was `None`")
        return {"response": "playerAlreadyInNetwork"}
    player.network = network
    db.session.commit()
    engine.log(f"{player.username} joined the network {network.name}")
    ws.rest_notify_network_change(engine)
    return {"response": "success"}


def create_network(engine, player, name):
    """shared API method to create a network. Network name must pass validation,
    namely it must not be too long, nor too short, and must not already be in
    use."""
    if len(name) < 3 or len(name) > 40:
        return {"response": "nameLengthInvalid"}
    if Network.query.filter_by(name=name).first() is not None:
        return {"response": "nameAlreadyUsed"}
    new_network = Network(name=name, members=[player])
    db.session.add(new_network)
    db.session.commit()
    network_path = f"instance/network_data/{new_network.id}"
    Path(f"{network_path}/charts").mkdir(parents=True, exist_ok=True)
    engine.data["network_data"][new_network.id] = CircularBufferNetwork()
    past_data = data_init_network()
    Path(f"{network_path}").mkdir(parents=True, exist_ok=True)
    with open(f"{network_path}/time_series.pck", "wb") as file:
        pickle.dump(past_data, file)
    engine.log(f"{player.username} created the network {name}")
    ws.rest_notify_network_change(engine)
    return {"response": "success"}


def leave_network(engine, player):
    """Shared API method for a player to leave a network. Always succeeds."""
    network = player.network
    if network is None:
        return {"response": "playerNotInNetwork"}
    player.network_id = None
    remaining_members_count = Player.query.filter_by(
        network_id=network.id
    ).count()
    # delete network if it is empty
    if remaining_members_count == 0:
        engine.log(
            f"The network {network.name} has been deleted because it was empty"
        )
        shutil.rmtree(f"instance/network_data/{network.id}")
        db.session.delete(network)
    db.session.commit()
    engine.log(f"{player.username} left the network {network.name}")
    ws.rest_notify_network_change(engine)
    return {"response": "success"}


def set_network_prices(engine, player, prices={}):
    """this function is executed when a player changes the value the enegy selling prices"""

    def sort_priority(priority_list, prefix="price_"):
        return sorted(priority_list, key=lambda x: getattr(player, prefix + x))

    def sort_SCP(SCP_list):
        return sorted(SCP_list, key=lambda x: engine.renewables.index(x))

    for price in prices:
        setattr(player, price, prices[price])

    rest_list = sort_priority(
        player.read_project_priority("rest_of_priorities")
    )
    SCP_list = sort_SCP(
        player.read_project_priority("self_consumption_priority")
    )
    demand_list = sort_priority(
        player.read_project_priority("demand_priorities"), prefix="price_buy_"
    )
    demand_list.reverse()

    engine.log(f"{player.username} updated their prices")

    comma = ","
    player.self_consumption_priority = comma.join(SCP_list)
    player.rest_of_priorities = comma.join(rest_list)
    player.demand_priorities = comma.join(demand_list)
    db.session.commit()


def get_scoreboard():
    players = Player.query.filter(Player.tile != None)  # noqa: E711
    return {
        player.id: {
            "money": player.money,
            "average_hourly_revenues": player.average_revenues,
            "co2_emissions": player.emissions,
        }
        for player in players
    }


def start_project(engine, player, facility, family):
    """this function is executed when a player clicks on 'start construction'"""
    assets = engine.config[player.id]["assets"]

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
            * engine.const_config[facility]["price multiplier"] ** ud_count
        )
        duration = (
            assets[facility]["construction time"]
            * engine.const_config[facility]["price multiplier"] ** ud_count
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
    player.add_project_priority(priority_list_name, new_construction.id)
    if suspension_time is None:
        player.project_max_priority(priority_list_name, new_construction.id)
    engine.log(f"{player.username} started the construction {facility}")
    ws.rest_notify_constructions(engine, player)
    return {
        "response": "success",
        "money": player.money,
        "constructions": get_construction_data(player),
    }


def cancel_project(player, construction_id):
    """this function is executed when a player cancels an ongoing construction"""
    engine = current_app.config["engine"]
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
    player.remove_project_priority(priority_list_name, construction_id)
    db.session.delete(construction)
    engine.log(
        f"{player.username} cancelled the construction {construction.name}"
    )
    db.session.commit()
    ws.rest_notify_constructions(engine, player)
    return {
        "response": "success",
        "money": player.money,
        "constructions": get_construction_data(player),
    }


def pause_project(player, construction_id):
    """this function is executed when a player pauses or unpauses an ongoing construction"""
    engine = current_app.config["engine"]
    construction = Under_construction.query.get(int(construction_id))

    if construction.suspension_time is None:
        while construction.suspension_time is None:
            response = decrease_project_priority(
                player, construction_id, pausing=True
            )
            if response["response"] == "paused":
                break
            if construction.family == "Technologies":
                last_project = response["constructions"][2][-1]
            else:
                last_project = response["constructions"][1][-1]
            if last_project == int(construction_id):
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
    ws.rest_notify_constructions(engine, player)
    return {
        "response": "success",
        "constructions": get_construction_data(player),
    }


def decrease_project_priority(player, construction_id, pausing=False):
    """this function is executed when a player changes the order of ongoing constructions"""
    engine = current_app.config["engine"]
    construction = Under_construction.query.get(int(construction_id))

    if construction.family == "Technologies":
        attr = "research_priorities"
    else:
        attr = "construction_priorities"

    id_list = player.read_project_priority(attr)
    index = id_list.index(construction_id)
    if index >= 0 and index < len(id_list) - 1:
        construction_1 = Under_construction.query.get(id_list[index])
        construction_2 = Under_construction.query.get(id_list[index + 1])
        if (
            construction_1.suspension_time is None
            and construction_2.suspension_time is not None
        ):
            construction_1.suspension_time = time.time()
            if pausing:
                return {"response": "paused"}
            construction_2.start_time += (
                time.time() - construction.suspension_time
            )
            construction_2.suspension_time = None
        id_list[index + 1], id_list[index] = (
            id_list[index],
            id_list[index + 1],
        )
        setattr(player, attr, ",".join(map(str, id_list)))
        db.session.commit()
        ws.rest_notify_constructions(engine, player)

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
