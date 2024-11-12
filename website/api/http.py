"""These functions make the link between the website and the database"""

import json
import pickle
from datetime import datetime
from functools import wraps
from pathlib import Path

import numpy as np
from flask import Blueprint, Response, current_app, flash, g, jsonify, redirect, request
from flask_login import current_user, login_required

# from gevent import getcurrent
import website.utils.assets
import website.utils.chat
import website.utils.misc
import website.utils.network
import website.utils.resource_market
from website.config.assets import wind_power_curve
from website.database.map import Hex
from website.database.messages import Chat
from website.database.player import Network, Player
from website.database.player_assets import ActiveFacility, OngoingConstruction, ResourceOnSale, Shipment
from website.game_engine import Confirm, GameException
from website.technology_effects import get_current_technology_values
from website.utils import misc
from website.utils.assets import package_projects_data
from website.utils.misc import flash_error

http = Blueprint("http", __name__)


def log_action(func):
    """This decorator logs all endpoint actions of the players"""

    @wraps(func)
    def wrapper(*args, **kwargs):
        if request.method != "POST":
            return func(*args, **kwargs)

        try:
            with g.engine.lock:
                # print(f"Greenlet ID {id(getcurrent())}: start")
                response = func(*args, **kwargs)
                # print(f"Greenlet ID {id(getcurrent())}: done")
            response, status_code = response if isinstance(response, tuple) else (response, 200)
        except GameException as excp:
            response, status_code = jsonify({"response": excp.exception_type, **excp.kwargs}), 403
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "action_type": "request",
            "player_id": current_user.id,
            "request": {
                "endpoint": request.path,
                "content_type": request.content_type,
                "content": request.get_json() if request.is_json else request.form.to_dict(),
            },
            "response": {
                "status_code": status_code,
                "content_type": response.content_type if isinstance(response, Response) else str(type(response)),
                "content": (response.json if response.is_json else response.data.decode("utf-8"))
                if isinstance(response, Response)
                else response,
            },
        }
        g.engine.action_logger.info(json.dumps(log_entry))
        return response, status_code

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
    return jsonify({"response": "success"} | response)


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
    answer_correct = website.utils.misc.submit_quiz_answer(g.engine, current_user, answer)
    return jsonify(
        {
            "response": "correct" if answer_correct else "incorrect",
            "question_data": get_quiz_question(g.engine, current_user),
        }
    )


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
    if selected_id < 0 or selected_id >= Hex.query.count():
        return jsonify({"resonse": "TileNotExist"})  # TODO
    location = Hex.query.get(selected_id + 1)
    misc.confirm_location(engine=g.engine, player=current_user, location=location)
    return jsonify({"response": "success"})


@http.route("/request_queue_project", methods=["POST"])
@log_action
def request_queue_project():
    """
    this function is executed when a player does any of the following:
    * initiates the construction or upgrades a building or an asset
    * starts a technology research
    """
    request_data = request.get_json()
    asset = request_data["facility"]
    force = request_data["force"]
    try:
        website.utils.assets.queue_project(
            engine=g.engine,
            player=current_user,
            asset=asset,
            force=force,
        )
    except Confirm as confirm:
        return jsonify(
            {
                "response": "areYouSure",
                "capacity": confirm.capacity,
                "construction_power": confirm.construction_power,
            }
        ), 300

    return jsonify(
        {
            "response": "success",
            "money": current_user.money,
            "constructions": package_projects_data(current_user),
        }
    )


@http.route("/request_cancel_project", methods=["POST"])
@log_action
def request_cancel_project():
    """This function is executed when a player cancels an ongoing construction or upgrade."""
    request_data = request.get_json()
    construction_id = int(request_data["id"])
    construction: OngoingConstruction = OngoingConstruction.query.get(int(construction_id))
    if construction is None or construction.player_id != current_user.id:
        return jsonify({"response": "constructionNotFound"}), 404
    force = request_data["force"]
    try:
        website.utils.assets.cancel_project(player=current_user, construction=construction, force=force)
    except Confirm as confirm:
        return jsonify(
            {
                "response": "areYouSure",
                "refund": confirm.refund,
            }
        ), 300
    return jsonify(
        {
            "response": "success",
            "money": current_user.money,
            "constructions": package_projects_data(current_user),
        }
    )


@http.route("/request_toggle_pause_project", methods=["POST"])
@log_action
def request_pause_project():
    """This function is executed when a player pauses or unpauses an ongoing construction or upgrade."""
    request_data = request.get_json()
    construction_id = int(request_data["id"])
    construction: OngoingConstruction = OngoingConstruction.query.get(int(construction_id))
    if construction is None or construction.player_id != current_user.id:
        return jsonify({"response": "constructionNotFound"}), 404
    website.utils.assets.toggle_pause_project(player=current_user, construction=construction)
    return jsonify(
        {
            "response": "success",
            "constructions": package_projects_data(current_user),
        }
    )


@http.route("/request_pause_shipment", methods=["POST"])
@log_action
def request_pause_shipment():
    """This function is executed when a player pauses or unpauses an ongoing construction or upgrade."""
    request_data = request.get_json()
    shipment_id = request_data["id"]
    shipment: Shipment = Shipment.query.get(int(shipment_id))
    if shipment is None or shipment.player_id != current_user.id:
        return jsonify({"response": "ShipmentNotFound"}), 404
    website.utils.resource_market.pause_shipment(shipment=shipment)
    return jsonify(
        {
            "response": "success",
            "shipments": current_user.package_shipments(),
        }
    )


@http.route("/request_decrease_project_priority", methods=["POST"])
@log_action
def request_decrease_project_priority():
    """This function is executed when a player changes the order of ongoing constructions or upgrades."""
    request_data = request.get_json()
    construction_id = request_data["id"]
    construction: OngoingConstruction = OngoingConstruction.query.get(int(construction_id))
    if construction is None or construction.player_id != current_user.id:
        return jsonify({"response": "constructionNotFound"}), 404
    website.utils.assets.decrease_project_priority(player=current_user, construction=construction)
    return jsonify(
        {
            "response": "success",
            "constructions": package_projects_data(current_user),
        }
    )


@http.route("/request_upgrade_facility", methods=["POST"])
@log_action
def request_upgrade_facility():
    """This function is executed when a player wants to upgrades a facility"""
    request_data = request.get_json()
    facility_id = request_data["facility_id"]
    facility: ActiveFacility = ActiveFacility.query.get(int(facility_id))
    if facility is None or facility.player_id != current_user.id:
        return jsonify({"response": "constructionNotFound"}), 404
    website.utils.assets.upgrade_facility(player=current_user, facility=facility)
    return jsonify({"response": "success", "money": current_user.money})


@http.route("/request_upgrade_all_of_type", methods=["POST"])
@log_action
def request_upgrade_all_of_type():
    """This function is executed when a player wants to upgrades all facilities of a certain type"""
    request_data = request.get_json()
    facility_id = request_data["facility_id"]
    facility: ActiveFacility = ActiveFacility.query.get(int(facility_id))
    if facility is None or facility.player_id != current_user.id:
        return jsonify({"response": "constructionNotFound"}), 404
    website.utils.assets.upgrade_all_of_type(player=current_user, facility_name=facility.facility)
    return jsonify({"response": "success", "money": current_user.money})


@http.route("/request_dismantle_facility", methods=["POST"])
@log_action
def request_dismantle_facility():
    """This function is executed when a player wants to dismantle a facility"""
    request_data = request.get_json()
    facility_id = request_data["facility_id"]
    facility: ActiveFacility = ActiveFacility.query.get(int(facility_id))
    if facility is None or facility.player_id != current_user.id:
        return jsonify({"response": "constructionNotFound"}), 404
    website.utils.assets.dismantle_facility(player=current_user, facility=facility)
    return jsonify(
        {
            "response": "success",
            "facility_name": facility.facility,
            "money": current_user.money,
        }
    )


@http.route("/request_dismantle_all_of_type", methods=["POST"])
@log_action
def request_dismantle_all_of_type():
    """This function is executed when a player wants to dismantle all facilities of a certain type"""
    request_data = request.get_json()
    facility_id = request_data["facility_id"]
    facility: ActiveFacility = ActiveFacility.query.get(int(facility_id))
    if facility is None or facility.player_id != current_user.id:
        return jsonify({"response": "constructionNotFound"}), 404
    website.utils.assets.dismantle_all_of_type(player=current_user, facility_name=facility.facility)
    return jsonify({"response": "success", "money": current_user.money})


@http.route("/change_network_prices", methods=["POST"])
@log_action
def change_network_prices():
    """this function is executed when a player changes the prices for anything on the network"""
    if not current_user.is_in_network:
        return jsonify({"response": "notAuthorized"}), 404
    request_data = request.get_json()
    updated_prices = {k.lstrip("price_"): v for k, v in request_data["prices"].items()}
    website.utils.network.set_network_prices(engine=g.engine, player=current_user, updated_prices=updated_prices)
    return jsonify({"response": "success"})


@http.route("/request_change_facility_priority", methods=["POST"])
@log_action
def request_change_facility_priority():
    """this function is executed when a player changes the generation priority"""
    if "Unlock Network" not in current_user.achievements:
        return jsonify({"response": "notAuthorized"}), 404
    request_data = request.get_json()
    priority = request_data["priority"]
    website.utils.network.change_facility_priority(engine=g.engine, player=current_user, priority=priority)
    return jsonify({"response": "success"})


@http.route("/put_resource_on_sale", methods=["POST"])
@log_action
def put_resource_on_sale():
    """Parse the HTTP form for selling resources"""
    request_data = request.get_json()
    resource = request_data["resource"]
    quantity = float(request_data["quantity"]) * 1000
    price = float(request_data["price"]) / 1000
    try:
        website.utils.resource_market.put_resource_on_market(current_user, resource, quantity, price)
    except GameException as excp:
        assert excp.exception_type == "notEnoughResource"
        flash_error(f"You have not enough {resource} available")
    flash(
        f"You put {quantity/1000}t of {resource} on sale for "
        f"{price*1000}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>/t",
        category="message",
    )
    return redirect("/resource_market", code=303)


@http.route("/buy_resource", methods=["POST"])
@log_action
def buy_resource():
    """Parse the HTTP form for buying resources"""
    request_data = request.get_json()
    sale_id = int(request_data["id"])
    quantity = float(request_data["quantity"]) * 1000
    sale = ResourceOnSale.query.get(int(sale_id))
    if sale is None:
        return jsonify({"response": "saleNotFound"}), 404
    website.utils.resource_market.buy_resource_from_market(current_user, quantity, sale)
    if current_user == sale.player:
        return jsonify(
            {
                "response": "removedFromMarket",
                "quantity": quantity,
                "available_quantity": sale.quantity,
                "resource": sale.resource,
            }
        )
    else:
        return jsonify(
            {
                "response": "success",
                "resource": sale.resource,
                "total_price": sale.price * quantity,
                "quantity": quantity,
                "seller": sale.player.username,
                "available_quantity": sale.quantity,
                "shipments": current_user.package_shipments(),
            }
        )


@http.route("join_network", methods=["POST"])
@log_action
def join_network():
    """player is trying to join a network"""
    request_data = request.get_json()
    network_name = request_data["choose_network"]
    network = Network.query.filter_by(name=network_name).first()
    website.utils.network.join_network(g.engine, current_user, network)
    flash(f"You joined the network {network_name}", category="message")
    g.engine.log(f"{current_user.username} joined the network {current_user.network.name}")
    return redirect("/network", code=303)


@http.route("create_network", methods=["POST"])
@log_action
def create_network():
    """This endpoint is used when a player creates a network"""
    request_data = request.get_json()
    network_name = request_data["network_name"]
    website.utils.network.create_network(g.engine, current_user, network_name)
    # TODO: flash(f"You created the network {network_name}", category="message")
    return redirect("/network", code=303)


@http.route("leave_network", methods=["POST"])
@log_action
def leave_network():
    """this endpoint is called when a player leaves their network"""
    network = current_user.network
    if network is None:
        return jsonify({"response": "notInNetwork"}), 404
    website.utils.network.leave_network(g.engine, current_user)
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
    buddy = Player.query.get(buddy_id)
    website.utils.chat.create_chat(current_user, buddy)
    return jsonify({"response": "success"})


@http.route("create_group_chat", methods=["POST"])
def create_group_chat():
    """this endpoint is called when a player creates a group chat"""
    request_data = request.get_json()
    chat_title = request_data["chat_title"]
    group_members = [current_user] + list(map(Player.query.get, request_data["group_members"]))
    website.utils.chat.create_group_chat(current_user, chat_title, group_members)
    return jsonify({"response": "success"})


@http.route("new_message", methods=["POST"])
def new_message():
    """this endpoint is called when a player writes a new message"""
    request_data = request.get_json()
    message = request_data["new_message"]
    chat_id = int(request_data["chat_id"])
    chat = Chat.query.get(chat_id)
    if chat_id is None:
        return jsonify({"response": "NoChatID"}), 403
    website.utils.chat.add_message(current_user, message, chat)
    return jsonify({"response": "success"})


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
