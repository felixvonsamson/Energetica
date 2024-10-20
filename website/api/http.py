"""These functions make the link between the website and the database"""

import json
import pickle
from datetime import datetime
from functools import wraps
from pathlib import Path

import numpy as np
from flask import Blueprint, current_app, flash, g, jsonify, redirect, request
from flask_login import current_user, login_required

import website.utils.assets
import website.utils.chat
import website.utils.misc
import website.utils.network
import website.utils.resource_market
from website.config.assets import wind_power_curve
from website.database.map import Hex
from website.database.player import Network, Player
from website.technology_effects import get_current_technology_values
from website.utils import misc

http = Blueprint("http", __name__)


def log_action(func):
    """This decorator logs all endpoint actions of the players"""

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
@login_required
def check_user():
    """
    Sets `g.engine` to point to the engine object. Executed before all
    `@http` request
    """
    g.engine = current_app.config["engine"]


@http.route("/request_delete_notification", methods=["POST"])
def request_delete_notification():
    """
    Endpoint for requesting the deletion of a notification
    Request Payload:
        {
            "id": int  # The ID of the notification to be deleted
        }
    """
    request_data = request.get_json()
    notification_id = request_data["id"]
    current_user.delete_notification(notification_id)
    return jsonify({"response": "success"})


@http.route("/request_marked_as_read", methods=["GET"])
def request_marked_as_read():
    """Endpoint for marking all notification as read"""
    current_user.notifications_read()
    return jsonify({"response": "success"})


@http.route("/get_const_config", methods=["GET"])
def get_const_config():
    """Gets constant config data"""
    return jsonify(g.engine.const_config)


@http.route("/get_wind_power_curve", methods=["GET"])
def get_wind_power_curve():
    """Gets the wind power curve"""
    return jsonify(wind_power_curve)


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
            "gas": tile.gas,
            "uranium": tile.uranium,
            "climate_risk": tile.climate_risk,
            "player_id": tile.player.id if tile.player else None,
        }
        for tile in hex_map
    ]
    return jsonify(hex_list)


# gets all the network names and returns it as a list :
@http.route("/get_networks", methods=["GET"])
def get_networks():
    """gets all the network names and returns it as a list"""
    network_list = Network.query.with_entities(Network.name).all()
    network_list = [name[0] for name in network_list]
    return jsonify(network_list)


@http.route("/get_chat_messages", methods=["GET"])
def get_chat_messages():
    """gets the last 20 messages from a chat and returns it as a list"""
    chat_id = request.args.get("chatID")
    packaged_messages = current_user.package_chat_messages(chat_id)
    return jsonify({"response": "success", "messages": packaged_messages})


@http.route("/get_chat_list", methods=["GET"])
def get_chat_list():
    """gets the list of chats for the current player"""
    response = current_user.package_chat_list()
    return response


@http.route("/get_resource_data", methods=["GET"])
def get_resource_data():
    """gets production rates and quantity on sale for every resource"""
    on_sale = {}
    for resource in ["coal", "gas", "uranium"]:
        on_sale[resource] = getattr(current_user, resource + "_on_sale")
    return jsonify(on_sale)


@http.route("/get_chart_data", methods=["GET"])
def get_chart_data():
    """gets the data for the overview charts"""

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

    current_climate_data = g.engine.data["current_climate_data"].get_data(t=total_t % 216 + 1)
    with open("instance/server_data/climate_data.pck", "rb") as file:
        climate_data = pickle.load(file)
    concat_slices(climate_data, current_climate_data)

    cumulative_emissions = g.engine.data["player_cumul_emissions"][current_user.id].get_all()

    return jsonify(
        {
            "total_t": total_t,
            "data": data,
            "network_data": network_data,
            "climate_data": climate_data,
            "cumulative_emissions": cumulative_emissions,
        }
    )


@http.route("/get_current_weather", methods=["GET"])
def get_current_weather():
    """gets the current weather data (date, irradiance, wind speed, river discharge)"""
    return jsonify(website.utils.misc.package_weather_data(g.engine, current_user))


@http.route("/get_network_capacities", methods=["GET"])
def get_network_capacities():
    """gets the network capacities for the current player"""
    if current_user.network is None:
        return "", 404
    network_capacities = g.engine.data["network_capacities"][current_user.network.id].get_all()
    return jsonify(network_capacities)


@http.route("/get_market_data", methods=["GET"])
def get_market_data():
    """gets the data for the market graph at a specific tick"""
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
    """Gets the natural resources reserves for this player"""
    reserves = current_user.get_reserves()
    return jsonify(reserves)


@http.route("/get_player_id", methods=["GET"])
def get_player_id():
    """Gets the id for this player"""
    return jsonify(current_user.id)


@http.route("/get_players", methods=["GET"])
def get_players():
    """Gets all the players information"""
    return jsonify(Player.package_all())


@http.route("/get_generation_priority", methods=["GET"])
def get_generation_priority():
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


@http.route("/get_upcoming_achievements", methods=["GET"])
def get_upcoming_achievements():
    """Gets the upcoming achievements for this player"""
    return jsonify(current_user.package_upcoming_achievements())


@http.route("/get_scoreboard", methods=["GET"])
def get_scoreboard():
    """Gets the scoreboard data"""
    return jsonify(Player.package_scoreboard())


@http.route("/get_quiz_question", methods=["GET"])
def get_quiz_question():
    """Gets the daily quiz question"""
    return jsonify(website.utils.misc.get_quiz_question(g.engine, current_user))


@http.route("/submit_quiz_answer", methods=["POST"])
def submit_quiz_answer():
    """Submits the daily quiz answer from a player"""
    request_data = request.get_json()
    answer = request_data["answer"]
    response = website.utils.misc.submit_quiz_answer(g.engine, current_user, answer)
    return response


@http.route("/get_active_facilities", methods=["GET"])
def get_active_facilities():
    """Gets list of active facilities for this player"""
    return jsonify(current_user.package_active_facilities())


@http.route("choose_location", methods=["POST"])
@log_action
def choose_location():
    """this function is executed when a player choses a location"""
    request_data = request.get_json()
    selected_id = request_data["selected_id"]
    location = Hex.query.get(selected_id + 1)
    confirm_location_response = misc.confirm_location(engine=g.engine, player=current_user, location=location)
    return confirm_location_response


@http.route("/request_start_project", methods=["POST"])
@log_action
def request_start_project():
    """
    this function is executed when a player does any of the following:
    * initiates the construction or upgrades a building or facility
    * starts a technology research
    """
    request_data = request.get_json()
    facility = request_data["facility"]
    family = request_data["family"]
    force = request_data["force"]
    response = website.utils.assets.start_project(
        engine=g.engine,
        player=current_user,
        asset=facility,
        family=family,
        force=force,
    )
    return response


@http.route("/request_cancel_project", methods=["POST"])
@log_action
def request_cancel_project():
    """This function is executed when a player cancels an ongoing construction or upgrade."""
    request_data = request.get_json()
    construction_id = int(request_data["id"])
    force = request_data["force"]
    response = website.utils.assets.cancel_project(player=current_user, construction_id=construction_id, force=force)
    return response


@http.route("/request_pause_project", methods=["POST"])
@log_action
def request_pause_project():
    """This function is executed when a player pauses or unpauses an ongoing construction or upgrade."""
    request_data = request.get_json()
    construction_id = request_data["id"]
    response = website.utils.assets.pause_project(player=current_user, construction_id=construction_id)
    return response


@http.route("/request_pause_shipment", methods=["POST"])
@log_action
def request_pause_shipment():
    """This function is executed when a player pauses or unpauses an ongoing construction or upgrade."""
    request_data = request.get_json()
    shipment_id = request_data["id"]
    response = website.utils.resource_market.pause_shipment(player=current_user, shipment_id=shipment_id)
    return response


@http.route("/request_decrease_project_priority", methods=["POST"])
@log_action
def request_decrease_project_priority():
    """This function is executed when a player changes the order of ongoing constructions or upgrades."""
    request_data = request.get_json()
    construction_id = request_data["id"]
    response = website.utils.assets.decrease_project_priority(player=current_user, construction_id=construction_id)
    return response


@http.route("/request_upgrade_facility", methods=["POST"])
@log_action
def request_upgrade_facility():
    """This function is executed when a player wants to upgrades a facility"""
    request_data = request.get_json()
    facility_id = request_data["facility_id"]
    response = website.utils.assets.upgrade_facility(player=current_user, facility_id=facility_id)
    return response


@http.route("/request_upgrade_all_of_type", methods=["POST"])
@log_action
def request_upgrade_all_of_type():
    """This function is executed when a player wants to upgrades all facilities of a certain type"""
    request_data = request.get_json()
    facility_id = request_data["facility_id"]
    response = website.utils.assets.upgrade_all_of_type(player=current_user, facility_id=facility_id)
    return response


@http.route("/request_dismantle_facility", methods=["POST"])
@log_action
def request_dismantle_facility():
    """This function is executed when a player wants to dismantle a facility"""
    request_data = request.get_json()
    facility_id = request_data["facility_id"]
    response = website.utils.assets.dismantle_facility(player=current_user, facility_id=facility_id)
    return response


@http.route("/request_dismantle_all_of_type", methods=["POST"])
@log_action
def request_dismantle_all_of_type():
    """This function is executed when a player wants to dismantle all facilities of a certain type"""
    request_data = request.get_json()
    facility_id = request_data["facility_id"]
    response = website.utils.assets.dismantle_all_of_type(player=current_user, facility_id=facility_id)
    return response


@http.route("/change_network_prices", methods=["POST"])
@log_action
def change_network_prices():
    """this function is executed when a player changes the prices for anything on the network"""
    request_data = request.get_json()
    updated_prices = request_data["prices"]
    response = website.utils.network.set_network_prices(
        engine=g.engine, player=current_user, updated_prices=updated_prices
    )
    return response


@http.route("/request_change_facility_priority", methods=["POST"])
@log_action
def request_change_facility_priority():
    """this function is executed when a player changes the generation priority"""
    request_data = request.get_json()
    priority = request_data["priority"]
    response = website.utils.network.change_facility_priority(engine=g.engine, player=current_user, priority=priority)
    return response


@http.route("/put_resource_on_sale", methods=["POST"])
@log_action
def put_resource_on_sale():
    """Parse the HTTP form for selling resources"""
    request_data = request.get_json()
    resource = request_data["resource"]
    quantity = float(request_data["quantity"]) * 1000
    price = float(request_data["price"]) / 1000
    website.utils.resource_market.put_resource_on_market(current_user, resource, quantity, price)
    return redirect("/resource_market", code=303)


@http.route("/buy_resource", methods=["POST"])
@log_action
def buy_resource():
    """Parse the HTTP form for buying resources"""
    request_data = request.get_json()
    sale_id = int(request_data["id"])
    quantity = float(request_data["quantity"]) * 1000
    response = website.utils.resource_market.buy_resource_from_market(current_user, quantity, sale_id)
    return response


@http.route("join_network", methods=["POST"])
@log_action
def join_network():
    """player is trying to join a network"""
    request_data = request.get_json()
    network_name = request_data["choose_network"]
    network = Network.query.filter_by(name=network_name).first()
    response = website.utils.network.join_network(g.engine, current_user, network)
    if type(response) == tuple:
        response, _ = response
    if response.json["response"] != "success":
        return response
    flash(f"You joined the network {network_name}", category="message")
    g.engine.log(f"{current_user.username} joined the network {current_user.network.name}")
    return redirect("/network", code=303)


@http.route("create_network", methods=["POST"])
@log_action
def create_network():
    """This endpoint is used when a player creates a network"""
    request_data = request.get_json()
    network_name = request_data["network_name"]
    response = website.utils.network.create_network(g.engine, current_user, network_name)
    if type(response) == tuple:
        response, _ = response
    if response.json["response"] == "nameLengthInvalid":
        flash("Network name must be between 3 and 40 characters", category="error")
        return redirect("/network", code=303)
    if response.json["response"] == "nameAlreadyUsed":
        flash("A network with this name already exists", category="error")
        return redirect("/network", code=303)
    flash(f"You created the network {network_name}", category="message")
    return redirect("/network", code=303)


@http.route("leave_network", methods=["POST"])
@log_action
def leave_network():
    """this endpoint is called when a player leaves their network"""
    network = current_user.network
    response = website.utils.network.leave_network(g.engine, current_user)
    if response["response"] == "success":
        flash(f"You left network {network.name}", category="message")
    return redirect("/network", code=303)


@http.route("hide_chat_disclaimer", methods=["GET"])
def hide_chat_disclaimer():
    """this endpoint is called when a player selects 'don't show again' on the chat disclaimer"""
    website.utils.chat.hide_chat_disclaimer(current_user)
    return jsonify({"response": "success"})


@http.route("create_chat", methods=["POST"])
def create_chat():
    """this endpoint is called when a player creates a chat with one other player"""
    request_data = request.get_json()
    buddy_id = request_data["buddy_id"]
    response = website.utils.chat.create_chat(current_user, buddy_id)
    return response


@http.route("create_group_chat", methods=["POST"])
def create_group_chat():
    """this endpoint is called when a player creates a group chat"""
    request_data = request.get_json()
    chat_title = request_data["chat_title"]
    group_members = request_data["group_members"]
    response = website.utils.chat.create_group_chat(current_user, chat_title, group_members)
    return response


@http.route("new_message", methods=["POST"])
def new_message():
    """this endpoint is called when a player writes a new message"""
    request_data = request.get_json()
    message = request_data["new_message"]
    chat_id = request_data["chat_id"]
    response = website.utils.chat.add_message(current_user, message, chat_id)
    return response


@http.route("change_graph_view", methods=["POST"])
def change_graph_view():
    """this endpoint is called when a player changes the view mode for the graphs (basic, normal, expert)"""
    request_data = request.get_json()
    view = request_data["view"]
    current_user.change_graph_view(view)
    return jsonify({"response": "success"})


@http.route("test_notification", methods=["GET"])
def test_notification():
    """this endpoint is used to send a dummy notification to the player"""
    notification_data = {
        "title": "Test notification",
        "body": f"{g.engine.data['total_t']} ({datetime.now()})",
    }
    current_user.send_notification(notification_data)
    return jsonify({"response": "success"})
