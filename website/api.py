"""
These functions make the link between the website and the database
"""

from flask import Blueprint, request, flash, jsonify, g, current_app, redirect
from flask_login import login_required, current_user
import pickle
import numpy as np
from pathlib import Path
from website import utils
from .database import Hex, Player, Chat, Network

api = Blueprint("api", __name__)


@api.before_request
@login_required
def check_user():
    g.engine = current_app.config["engine"]


@api.route("/request_delete_notification", methods=["POST"])
def request_delete_notification():
    """
    this function is executed when a player deletes a notification
    """
    json = request.get_json()
    notification_id = json["id"]
    current_user.delete_notification(notification_id)
    return jsonify({"response": "success"})


@api.route("/request_marked_as_read", methods=["GET"])
def request_marked_as_read():
    """
    this function is executed when a player read the notifications
    """
    current_user.notifications_read()
    return jsonify({"response": "success"})


@api.route("/get_const_config", methods=["GET"])
def get_const_config():
    """Gets constant config data"""
    return jsonify(g.engine.const_config)


# gets the map data from the database and returns it as a array of dictionaries :
@api.route("/get_map", methods=["GET"])
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
            "player": tile.player.username if tile.player else None,
        }
        for tile in hex_map
    ]
    with_id = request.args.get("with_id")
    if with_id is None:
        return jsonify(hex_list)
    else:
        return jsonify(hex_list, current_user.tile.id)


# gets all the player usernames (except it's own) and returns it as a list :
@api.route("/get_usernames", methods=["GET"])
def get_usernames():
    username_list = Player.query.with_entities(Player.username).all()
    username_list = [
        username[0]
        for username in username_list
        if username[0] != current_user.username
    ]
    return jsonify(username_list)


# gets all the network names and returns it as a list :
@api.route("/get_networks", methods=["GET"])
def get_networks():
    network_list = Network.query.with_entities(Network.name).all()
    network_list = [name[0] for name in network_list]
    return jsonify(network_list)


# gets the last 20 messages from a chat and returns it as a list :
@api.route("/get_chat", methods=["GET"])
def get_chat():
    chat_id = request.args.get("chatID")
    messages = Chat.query.filter_by(id=chat_id).first().messages
    messages_list = [(msg.player.username, msg.text) for msg in messages]
    return jsonify(messages_list)


@api.route("/get_resource_data", methods=["GET"])
def get_resource_data():
    """gets production rates and quantity on sale for every resource"""
    rates = {}
    on_sale = {}
    for resource in [
        ("coal", "coal_mine"),
        ("oil", "oil_field"),
        ("gas", "gas_drilling_site"),
        ("uranium", "uranium_mine"),
    ]:
        rates[resource[0]] = (
            getattr(current_user, resource[1])
            * g.engine.config[current_user.id]["assets"][resource[1]][
                "amount produced"
            ]
        )
        on_sale[resource[0]] = getattr(current_user, resource[0] + "_on_sale")
    return jsonify(rates, on_sale)


# Gets the data for the overview charts
@api.route("/get_chart_data", methods=["GET"])
def get_chart_data():
    def calculate_mean_subarrays(array, x):
        return [np.mean(array[i : i + x]) for i in range(0, len(array), x)]

    def concat_slices(dict1, dict2):
        for key, value in dict2.items():
            for sub_key, array2 in value.items():
                if sub_key not in dict1[key]:
                    dict1[key][sub_key] = [[0.0] * 1440] * 4
                array = dict1[key][sub_key]
                concatenated_array = list(array[0]) + array2
                dict1[key][sub_key][0] = concatenated_array[-1440:]
                new_5days = calculate_mean_subarrays(array2, 5)
                dict1[key][sub_key][1] = dict1[key][sub_key][1][
                    len(new_5days) :
                ]
                dict1[key][sub_key][1].extend(new_5days)
                new_month = calculate_mean_subarrays(new_5days, 6)
                l2v = dict1[key][sub_key][2][-2:]
                dict1[key][sub_key][2] = dict1[key][sub_key][2][
                    len(new_month) :
                ]
                dict1[key][sub_key][2].extend(new_month)
                new_6month = calculate_mean_subarrays(new_month, 6)
                if total_t % 180 >= 120:
                    new_6month[0] = new_6month[0] / 3 + l2v[0] / 3 + l2v[1] / 3
                elif total_t % 180 >= 60:
                    new_6month[0] = new_6month[0] / 2 + l2v[1] / 2
                dict1[key][sub_key][3] = dict1[key][sub_key][3][
                    len(new_6month) :
                ]
                dict1[key][sub_key][3].extend(new_6month)

    total_t = g.engine.data["total_t"]
    current_data = g.engine.data["current_data"][current_user.id].get_data(
        t=total_t % 60 + 1
    )
    filename = f"instance/player_data/player_{current_user.id}.pck"
    with open(filename, "rb") as file:
        data = pickle.load(file)
    concat_slices(data, current_data)

    network_data = {"network_data": None}
    if current_user.network is not None:
        current_network_data = {
            "network_data": g.engine.data["network_data"][
                current_user.network.id
            ].get_data(t=total_t % 60 + 1)
        }
        filename = (
            f"instance/network_data/{current_user.network.id}/time_series.pck"
        )
        with open(filename, "rb") as file:
            network_data = {"network_data": pickle.load(file)}
        concat_slices(network_data, current_network_data)

    return jsonify(
        {
            "total_t": total_t,
            "data": data,
            "network_data": network_data["network_data"],
        }
    )


# Gets the data from the market for the market graph
@api.route("/get_market_data", methods=["GET"])
def get_market_data():
    market_data = {}
    if current_user.network is None:
        return "", 404
    t = int(request.args.get("t"))
    filename_state = f"instance/network_data/{current_user.network.id}/charts/market_t{g.engine.data['total_t']-t}.pck"
    if Path(filename_state).is_file():
        with open(filename_state, "rb") as file:
            market_data = pickle.load(file)
            market_data["capacities"] = market_data["capacities"].to_dict(
                orient="list"
            )
            market_data["demands"] = market_data["demands"].to_dict(
                orient="list"
            )
    else:
        market_data = None
    return jsonify(market_data)


@api.route("/get_player_data", methods=["GET"])
def get_player_data():
    """Gets count of assets and config for this player"""
    asset_count = current_user.get_values()
    config = g.engine.config[current_user.id]
    return jsonify(asset_count, config)


@api.route("/get_players", methods=["GET"])
def get_players():
    return jsonify(utils.package_players())


@api.route("/get_generation_prioirity", methods=["GET"])
def get_generation_prioirity():
    """Gets generation and demand priority for this player"""
    renewable_priorities = current_user.read_project_priority(
        "self_consumption_priority"
    )
    rest_of_priorities = current_user.read_project_priority(
        "rest_of_priorities"
    )
    for facility in rest_of_priorities[:]:
        if facility in g.engine.storage_facilities:
            for j, f in enumerate(rest_of_priorities):
                if getattr(current_user, "price_buy_" + facility) < getattr(
                    current_user, "price_" + f
                ):
                    rest_of_priorities.insert(j, "buy_" + facility)
                    break
                if j + 1 == len(rest_of_priorities):
                    rest_of_priorities.append("buy_" + facility)
                    break
    demand_priorities = current_user.read_project_priority("demand_priorities")
    for demand in demand_priorities:
        for j, f in enumerate(rest_of_priorities):
            if getattr(current_user, "price_buy_" + demand) < getattr(
                current_user, "price_" + f
            ):
                rest_of_priorities.insert(j, "buy_" + demand)
                break
            if j + 1 == len(rest_of_priorities):
                rest_of_priorities.append("buy_" + demand)
                break
    return jsonify(renewable_priorities, rest_of_priorities)


@api.route("/get_constructions", methods=["GET"])
def get_constructions():
    """Gets list of facilities under construction for this player"""
    projects = current_user.get_constructions()
    construction_priorities = current_user.read_project_priority(
        "construction_priorities"
    )
    research_priorities = current_user.read_project_priority(
        "research_priorities"
    )
    return jsonify(projects, construction_priorities, research_priorities)


# gets scoreboard data :
@api.route("/get_scoreboard", methods=["GET"])
def get_scoreboard():
    scoreboard_data = []
    players = Player.query.all()
    for player in players:
        scoreboard_data.append(
            [
                player.username,
                player.money,
                player.average_revenues,
                player.emissions,
            ]
        )
    return jsonify(scoreboard_data)


@api.route("choose_location", methods=["POST"])
def choose_location():
    """this function is executed when a player choses a location"""
    json = request.get_json()
    selected_id = json["selected_id"]
    location = Hex.query.get(selected_id + 1)
    confirm_location_response = utils.confirm_location(
        engine=g.engine, player=current_user, location=location
    )
    return jsonify(confirm_location_response)


@api.route("/request_start_project", methods=["POST"])
def request_start_project():
    """
    this function is executed when a player does any of the following:
    * initiates the construction or upgrades a building or facility
    * starts a technology research
    """
    json = request.get_json()
    facility = json["facility"]
    family = json["family"]
    response = utils.start_project(
        engine=g.engine, player=current_user, facility=facility, family=family
    )
    return jsonify(response)


@api.route("/request_cancel_project", methods=["POST"])
def request_cancel_project():
    """
    this function is executed when a player cancels an ongoing construction or upgrade
    """
    json = request.get_json()
    construction_id = json["id"]
    response = utils.cancel_project(
        player=current_user, construction_id=construction_id
    )
    return jsonify(response)


@api.route("/request_pause_project", methods=["POST"])
def request_pause_project():
    """
    this function is executed when a player pauses or unpauses an ongoing construction or upgrade
    """
    json = request.get_json()
    construction_id = json["id"]
    response = utils.pause_project(
        player=current_user, construction_id=construction_id
    )
    return jsonify(response)


@api.route("/request_increase_project_priority", methods=["POST"])
def request_increase_project_priority():
    """
    this function is executed when a player changes the order of ongoing constructions or upgrades
    """
    json = request.get_json()
    construction_id = json["id"]
    response = utils.increase_project_priority(
        player=current_user, construction_id=construction_id
    )
    return jsonify(response)


@api.route("/change_network_prices", methods=["POST"])
def change_network_prices():
    """this function is executed when a player changes the prices for anything
    on the network"""
    json = request.get_json()
    prices = json["prices"]
    utils.set_network_prices(
        engine=g.engine, player=current_user, prices=prices
    )
    return jsonify("success")


@api.route("/request_change_facility_priority", methods=["POST"])
def request_change_facility_priority():
    """this function is executed when a player changes the generation priority"""
    json = request.get_json()
    priority = json["priority"]
    price_list = []
    for facility in priority:
        price_list.append(getattr(current_user, "price_" + facility))
    price_list.sort()
    prices = {}
    for i, facility in enumerate(priority):
        prices["price_" + facility] = price_list[i]
    utils.set_network_prices(
        engine=g.engine, player=current_user, prices=prices
    )
    return jsonify("success")


@api.route("/put_resource_on_sale", methods=["POST"])
def put_resource_on_sale():
    """Parse the HTTP form for selling resources"""
    resource = request.form.get("resource")
    quantity = float(request.form.get("quantity")) * 1000
    price = float(request.form.get("price")) / 1000
    utils.put_resource_on_market(current_user, resource, quantity, price)
    return redirect("/resource_market", code=303)


@api.route("/buy_resource", methods=["POST"])
def buy_resource():
    """Parse the HTTP form for buying resources"""
    quantity = float(request.form.get("purchases_quantity")) * 1000
    sale_id = int(request.form.get("sale_id"))
    utils.buy_resource_from_market(current_user, quantity, sale_id)
    return redirect("/resource_market", code=303)


@api.route("join_network", methods=["POST"])
def join_network():
    """player is trying to join a network"""
    network_name = request.form.get("choose_network")
    network = Network.query.filter_by(name=network_name).first()
    utils.join_network(g.engine, current_user, network)
    flash(f"You joined the network {network_name}", category="message")
    g.engine.log(
        f"{current_user.username} joined the network {current_user.network.name}"
    )
    return redirect("/network", code=303)


@api.route("create_network", methods=["POST"])
def create_network():
    """This endpoint is used when a player creates a network"""
    network_name = request.form.get("network_name")
    response = utils.create_network(g.engine, current_user, network_name)
    if response["response"] == "nameLengthInvalid":
        flash(
            "Network name must be between 3 and 40 characters", category="error"
        )
        return redirect("/network", code=303)
    if response["response"] == "nameAlreadyUsed":
        flash("A network with this name already exists", category="error")
        return redirect("/network", code=303)
    return redirect("/network", code=303)


@api.route("leave_network", methods=["POST"])
def leave_network():
    """this endpoint is called when a player leaves their network"""
    network = current_user.network
    response = utils.leave_network(g.engine, current_user)
    if response["response"] == "success":
        flash(f"You left network {network.name}", category="message")
    return redirect("/network", code=303)
