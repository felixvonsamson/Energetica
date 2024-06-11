"""
These functions make the link between the website and the database
"""

from flask import Blueprint, request, flash, jsonify, g, current_app, redirect
from flask_login import current_user
import pickle
import json
import numpy as np
from datetime import datetime
from pathlib import Path
from functools import wraps
from website import utils
from ..database.map import Hex
from ..database.player import Network, Player
from ..technology_effects import get_current_technology_values

http = Blueprint("http", __name__)


def combined_authenticator(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not current_user.is_authenticated:
            return current_app.config["engine"].auth.login_required(func)(*args, **kwargs)
        return func(*args, **kwargs)

    return wrapper


def log_action(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "player_id": current_user.id,
            "endpoint": request.path,
            "method": request.method,
        }
        if request.content_type == "application/json":
            log_entry["request_content"] = request.get_json()
        else:
            log_entry["request_content"] = request.form.to_dict()
        g.engine.action_logger.info(json.dumps(log_entry))
        return func(*args, **kwargs)

    return wrapper


@http.before_request
@combined_authenticator
def check_user():
    g.engine = current_app.config["engine"]


@http.route("/request_delete_notification", methods=["POST"])
def request_delete_notification():
    """
    this function is executed when a player deletes a notification
    """
    json = request.get_json()
    notification_id = json["id"]
    current_user.delete_notification(notification_id)
    return jsonify({"response": "success"})


@http.route("/request_marked_as_read", methods=["GET"])
def request_marked_as_read():
    """
    this function is executed when a player read the notifications
    """
    current_user.notifications_read()
    return jsonify({"response": "success"})


@http.route("/get_const_config", methods=["GET"])
def get_const_config():
    """Gets constant config data"""
    return jsonify(g.engine.const_config)


# gets the map data from the database and returns it as a array of dictionaries :
@http.route("/get_map", methods=["GET"])
def get_map():
    """gets the map data from the database and returns it as a array of dictionaries"""
    hex_map = Hex.query.all()
    hex_list = [
        {
            "id": tile.id,
            "q": tile.q,
            "r": tile.r,
            "solar": tile.solar,
            "wind": tile.wind,
            "hydro": tile.hydro,
            "coal": tile.coal,
            "oil": tile.oil,
            "gas": tile.gas,
            "uranium": tile.uranium,
            "player_id": tile.player.id if tile.player else None,
        }
        for tile in hex_map
    ]
    return jsonify(hex_list)


# gets all the network names and returns it as a list :
@http.route("/get_networks", methods=["GET"])
def get_networks():
    network_list = Network.query.with_entities(Network.name).all()
    network_list = [name[0] for name in network_list]
    return jsonify(network_list)


@http.route("/get_chat_messages", methods=["GET"])
def get_chat_messages():
    """gets the last 20 messages from a chat and returns it as a list"""
    chat_id = request.args.get("chatID")
    response = current_user.package_chat_messages(chat_id)
    return jsonify(response)


@http.route("/get_chat_list", methods=["GET"])
def get_chat_list():
    response = current_user.package_chat_list()
    return jsonify(response)


@http.route("/get_resource_data", methods=["GET"])
def get_resource_data():
    """gets production rates and quantity on sale for every resource"""
    on_sale = {}
    for resource in ["coal", "oil", "gas", "uranium"]:
        on_sale[resource] = getattr(current_user, resource + "_on_sale")
    return jsonify(on_sale)


# Gets the data for the overview charts
@http.route("/get_chart_data", methods=["GET"])
def get_chart_data():
    def calculate_mean_subarrays(array, x):
        return [np.mean(array[i : i + x]) for i in range(0, len(array), x)]

    def concat_slices(dict1, dict2):
        for key, value in dict2.items():
            for sub_key, array2 in value.items():
                if sub_key not in dict1[key]:
                    dict1[key][sub_key] = [[0.0] * 360] * 5
                array = dict1[key][sub_key]
                concatenated_array = list(array[0]) + array2
                dict1[key][sub_key][0] = concatenated_array[-360:]
                new_5days = calculate_mean_subarrays(array2, 5)
                dict1[key][sub_key][1] = dict1[key][sub_key][1][len(new_5days) :]
                dict1[key][sub_key][1].extend(new_5days)
                new_month = calculate_mean_subarrays(new_5days, 6)
                l2v = dict1[key][sub_key][2][-2:]
                dict1[key][sub_key][2] = dict1[key][sub_key][2][len(new_month) :]
                dict1[key][sub_key][2].extend(new_month)
                new_6month = calculate_mean_subarrays(new_month, 6)
                if total_t % 180 >= 120:
                    new_6month[0] = new_6month[0] / 3 + l2v[0] / 3 + l2v[1] / 3
                elif total_t % 180 >= 60:
                    new_6month[0] = new_6month[0] / 2 + l2v[1] / 2
                dict1[key][sub_key][3] = dict1[key][sub_key][3][len(new_6month) :]
                dict1[key][sub_key][3].extend(new_6month)

    if current_user.tile is None:
        return "", 404
    total_t = g.engine.data["total_t"]
    current_data = g.engine.data["current_data"][current_user.id].get_data(t=total_t % 216 + 1)
    filename = f"instance/player_data/player_{current_user.id}.pck"
    with open(filename, "rb") as file:
        data = pickle.load(file)
    concat_slices(data, current_data)

    network_data = None
    if current_user.network is not None:
        current_network_data = g.engine.data["network_data"][current_user.network.id].get_data(t=total_t % 216 + 1)
        filename = f"instance/network_data/{current_user.network.id}/time_series.pck"
        with open(filename, "rb") as file:
            network_data = pickle.load(file)
        concat_slices(network_data, current_network_data)

    return jsonify(
        {
            "total_t": total_t,
            "data": data,
            "network_data": network_data,
        }
    )


# Gets the data from the market for the market graph
@http.route("/get_market_data", methods=["GET"])
def get_market_data():
    market_data = {}
    if current_user.network is None:
        return "", 404
    t = int(request.args.get("t"))
    filename_state = f"instance/network_data/{current_user.network.id}/charts/market_t{g.engine.data['total_t']-t}.pck"
    if Path(filename_state).is_file():
        with open(filename_state, "rb") as file:
            market_data = pickle.load(file)
            market_data["capacities"] = market_data["capacities"].to_dict(orient="list")
            market_data["demands"] = market_data["demands"].to_dict(orient="list")
    else:
        market_data = None
    return jsonify(market_data)


@http.route("/get_player_data", methods=["GET"])
def get_player_data():
    """Gets count of assets and config for this player"""
    if current_user.tile is None:
        return "", 404
    levels = current_user.get_lvls()
    config = g.engine.config[current_user.id]
    capacities = g.engine.data["player_capacities"][current_user.id].get_all()
    return jsonify(
        {
            "levels": levels,
            "config": config,
            "capacities": capacities,
            "multipliers": get_current_technology_values(current_user),
        }
    )


@http.route("/get_resource_reserves", methods=["GET"])
def get_resource_reserves():
    reserves = current_user.get_reserves()
    return jsonify(reserves)


@http.route("/get_player_id", methods=["GET"])
def get_player_id():
    """Gets the id for this player"""
    return jsonify(current_user.id)


@http.route("/get_players", methods=["GET"])
def get_players():
    return jsonify(Player.package_all())


@http.route("/get_generation_prioirity", methods=["GET"])
def get_generation_prioirity():
    """Gets generation and demand priority for this player"""
    renewable_priorities = current_user.read_list("self_consumption_priority")
    rest_of_priorities = current_user.read_list("rest_of_priorities")
    demand_priorities = current_user.read_list("demand_priorities")
    for demand in demand_priorities:
        for j, f in enumerate(rest_of_priorities):
            if getattr(current_user, "price_buy_" + demand) < getattr(current_user, "price_" + f):
                rest_of_priorities.insert(j, "buy_" + demand)
                break
            if j + 1 == len(rest_of_priorities):
                rest_of_priorities.append("buy_" + demand)
                break
    return jsonify(renewable_priorities, rest_of_priorities)


@http.route("/get_constructions", methods=["GET"])
def get_constructions():
    """Gets list of facilities under construction for this player"""
    projects = current_user.package_constructions()
    construction_priorities = current_user.read_list("construction_priorities")
    research_priorities = current_user.read_list("research_priorities")
    return jsonify(projects, construction_priorities, research_priorities)


@http.route("/get_shipments", methods=["GET"])
def get_shipments():
    """Gets list of shipments under way for this player"""
    return jsonify(current_user.package_shipments())


# gets scoreboard data :
@http.route("/get_scoreboard", methods=["GET"])
def get_scoreboard():
    """Gets the scoreboard data"""
    return jsonify(utils.get_scoreboard())


@http.route("/get_active_facilities", methods=["GET"])
def get_active_facilities():
    """Gets list of active facilities for this player"""
    return jsonify(current_user.package_active_facilities())


@http.route("choose_location", methods=["POST"])
@log_action
def choose_location():
    """this function is executed when a player choses a location"""
    json = request.get_json()
    selected_id = json["selected_id"]
    location = Hex.query.get(selected_id + 1)
    confirm_location_response = utils.confirm_location(engine=g.engine, player=current_user, location=location)
    return jsonify(confirm_location_response)


@http.route("/request_start_project", methods=["POST"])
@log_action
def request_start_project():
    """
    this function is executed when a player does any of the following:
    * initiates the construction or upgrades a building or facility
    * starts a technology research
    """
    json = request.get_json()
    facility = json["facility"]
    family = json["family"]
    force = json["force"]
    response = utils.start_project(
        engine=g.engine,
        player=current_user,
        facility=facility,
        family=family,
        force=force,
    )
    return jsonify(response)


@http.route("/request_cancel_project", methods=["POST"])
@log_action
def request_cancel_project():
    """
    this function is executed when a player cancels an ongoing construction or upgrade
    """
    json = request.get_json()
    construction_id = json["id"]
    force = json["force"]
    response = utils.cancel_project(player=current_user, construction_id=construction_id, force=force)
    return jsonify(response)


@http.route("/request_pause_project", methods=["POST"])
@log_action
def request_pause_project():
    """
    this function is executed when a player pauses or unpauses an ongoing construction or upgrade
    """
    json = request.get_json()
    construction_id = json["id"]
    response = utils.pause_project(player=current_user, construction_id=construction_id)
    return jsonify(response)


@http.route("/request_pause_shipment", methods=["POST"])
@log_action
def request_pause_shipment():
    """
    this function is executed when a player pauses or unpauses an ongoing construction or upgrade
    """
    json = request.get_json()
    shipment_id = json["id"]
    response = utils.pause_shipment(player=current_user, shipment_id=shipment_id)
    return jsonify(response)


@http.route("/request_decrease_project_priority", methods=["POST"])
@log_action
def request_decrease_project_priority():
    """
    this function is executed when a player changes the order of ongoing constructions or upgrades
    """
    json = request.get_json()
    construction_id = json["id"]
    response = utils.decrease_project_priority(player=current_user, construction_id=construction_id)
    return jsonify(response)


@http.route("/request_upgrade_facility", methods=["POST"])
@log_action
def request_upgrade_facility():
    json = request.get_json()
    facility_id = json["facility_id"]
    response = utils.upgrade_facility(player=current_user, facility_id=facility_id)
    return jsonify(response)


@http.route("/request_dismantle_facility", methods=["POST"])
@log_action
def request_dismantle_facility():
    json = request.get_json()
    facility_id = json["facility_id"]
    response = utils.dismantle_facility(player=current_user, facility_id=facility_id)
    return jsonify(response)


@http.route("/change_network_prices", methods=["POST"])
@log_action
def change_network_prices():
    """this function is executed when a player changes the prices for anything
    on the network"""
    json = request.get_json()
    prices = json["prices"]
    response = utils.set_network_prices(engine=g.engine, player=current_user, prices=prices)
    return jsonify(response)


@http.route("/request_change_facility_priority", methods=["POST"])
@log_action
def request_change_facility_priority():
    """this function is executed when a player changes the generation priority"""
    json = request.get_json()
    priority = json["priority"]
    response = utils.change_facility_priority(engine=g.engine, player=current_user, priority=priority)
    return jsonify(response)


@http.route("/put_resource_on_sale", methods=["POST"])
@log_action
def put_resource_on_sale():
    """Parse the HTTP form for selling resources"""
    resource = request.form.get("resource")
    quantity = float(request.form.get("quantity")) * 1000
    price = float(request.form.get("price")) / 1000
    utils.put_resource_on_market(current_user, resource, quantity, price)
    return redirect("/resource_market", code=303)


@http.route("/buy_resource", methods=["POST"])
@log_action
def buy_resource():
    """Parse the HTTP form for buying resources"""
    json = request.get_json()
    sale_id = int(json["id"])
    quantity = float(json["quantity"]) * 1000
    response = utils.buy_resource_from_market(current_user, quantity, sale_id)
    return jsonify(response)


@http.route("join_network", methods=["POST"])
@log_action
def join_network():
    """player is trying to join a network"""
    network_name = request.form.get("choose_network")
    network = Network.query.filter_by(name=network_name).first()
    utils.join_network(g.engine, current_user, network)
    flash(f"You joined the network {network_name}", category="message")
    g.engine.log(f"{current_user.username} joined the network {current_user.network.name}")
    return redirect("/network", code=303)


@http.route("create_network", methods=["POST"])
@log_action
def create_network():
    """This endpoint is used when a player creates a network"""
    network_name = request.form.get("network_name")
    response = utils.create_network(g.engine, current_user, network_name)
    if response["response"] == "nameLengthInvalid":
        flash("Network name must be between 3 and 40 characters", category="error")
        return redirect("/network", code=303)
    if response["response"] == "nameAlreadyUsed":
        flash("A network with this name already exists", category="error")
        return redirect("/network", code=303)
    flash(f"You created the network {network_name}", category="message")
    g.engine.log(f"{current_user.username} created the network {current_user.network.name}")
    return redirect("/network", code=303)


@http.route("leave_network", methods=["POST"])
@log_action
def leave_network():
    """this endpoint is called when a player leaves their network"""
    network = current_user.network
    response = utils.leave_network(g.engine, current_user)
    if response["response"] == "success":
        flash(f"You left network {network.name}", category="message")
    return redirect("/network", code=303)


@http.route("hide_chat_disclaimer", methods=["GET"])
def hide_chat_disclaimer():
    """this endpoint is called when a player selects 'don't show again' on the chat disclamer"""
    utils.hide_chat_disclaimer(current_user)
    return jsonify({"response": "success"})


@http.route("create_chat", methods=["POST"])
def create_chat():
    """this endpoint is called when a player creates a chat with one other player"""
    json = request.get_json()
    buddy_username = json["buddy_username"]
    response = utils.create_chat(current_user, buddy_username)
    return jsonify(response)


@http.route("create_group_chat", methods=["POST"])
def create_group_chat():
    """this endpoint is called when a player creates a group chat"""
    json = request.get_json()
    chat_title = json["chat_title"]
    group_memebers = json["group_memebers"]
    response = utils.create_group_chat(current_user, chat_title, group_memebers)
    return jsonify(response)


@http.route("new_message", methods=["POST"])
def new_message():
    """this endpoint is called when a player writes a new message"""
    json = request.get_json()
    message = json["new_message"]
    chat_id = json["chat_id"]
    response = utils.add_message(current_user, message, chat_id)
    return response
