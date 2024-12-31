"""These functions make the link between the website and the database."""

import json
import pickle
from collections.abc import Callable
from datetime import datetime
from functools import wraps
from pathlib import Path
from typing import TYPE_CHECKING

import numpy as np
from flask import Blueprint, flash, jsonify, redirect, request
from flask_login import current_user, login_required
from werkzeug.wrappers import Response

import energetica.utils.assets
import energetica.utils.chat
import energetica.utils.misc
import energetica.utils.network_helpers
import energetica.utils.resource_market
from energetica.config.assets import wind_power_curve
from energetica.database.active_facility import ActiveFacility
from energetica.database.map import HexTile
from energetica.database.messages import Chat
from energetica.database.network import Network
from energetica.database.ongoing_construction import OngoingProject
from energetica.database.player import Player
from energetica.database.resource_on_sale import ResourceOnSale
from energetica.game_engine import Confirm
from energetica.game_error import GameError
from energetica.globals import engine
from energetica.utils.assets import package_projects_data
from energetica.utils.misc import flash_error

http = Blueprint("http", __name__)


def log_action(func: Callable) -> Callable:
    """Log all endpoint actions of the players."""

    @wraps(func)
    def wrapper(*args, **kwargs):
        if request.method != "POST":
            return func(*args, **kwargs)

        try:
            with engine.lock:
                response = func(*args, **kwargs)
            response, status_code = response if isinstance(response, tuple) else (response, response.status_code)
        except GameError as game_exception:
            # TODO: engine.db.rollback() or something similar
            response, status_code = jsonify({"response": game_exception.exception_type, **game_exception.kwargs}), 403

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
        engine.action_logger.info(json.dumps(log_entry))
        return response, status_code

    return wrapper


@http.before_request
@login_required
def check_if_logged_in():
    # TODO(mglst): what is the purpose of this function? Please add a docstring
    pass


@http.route("/request_delete_notification", methods=["POST"])
def request_delete_notification() -> Response:
    """
    Delete a notification from the player's notification list.

    Request Payload:
        {
            "id": int  # The ID of the notification to be deleted
        }
    """
    request_data = request.get_json()
    notification_id = request_data["id"]
    current_user.delete_notification(notification_id)
    return jsonify({"response": "success"})


@http.route("/request_marked_as_read", methods=["POST"])
def request_marked_as_read() -> Response:
    """Mark all notification as read."""
    current_user.notifications_read()
    return jsonify({"response": "success"})


@http.route("/get_const_config", methods=["GET"])
def get_const_config() -> Response:
    """Get constant config data."""
    return jsonify(engine.const_config)


@http.route("/get_wind_power_curve", methods=["GET"])
def get_wind_power_curve() -> Response:
    """Get the wind power curve."""
    return jsonify(wind_power_curve)


# gets the map data from the database and returns it as a array of dictionaries :
@http.route("/get_map", methods=["GET"])
def get_map() -> Response:
    """Get the map data from the database and returns it as a array of dictionaries."""
    hex_map = HexTile.all()
    hex_list = [
        {
            "id": tile.id,
            "q": tile.coordinates[0],
            "r": tile.coordinates[1],
            "solar": tile.solar_potential,
            "wind": tile.wind_potential,
            "hydro": tile.hydro_potential,
            "coal": tile.coal_reserves,
            "gas": tile.gas_reserves,
            "uranium": tile.uranium_reserves,
            "climate_risk": tile.climate_risk,
            "player_id": tile.player.id if tile.player else None,
        }
        for tile in hex_map
    ]
    return jsonify(hex_list)


# gets all the network names and returns it as a list :
@http.route("/get_networks", methods=["GET"])
def get_networks() -> Response:
    """Get all the network names and returns it as a list."""
    network_list = [{"id": network.id, "name": network.name} for network in Network.all()]
    return jsonify(network_list)


@http.route("/get_chat_messages", methods=["GET"])
def get_chat_messages() -> Response:
    """Get the last 20 messages from a chat and returns it as a list."""
    chat_id = request.args.get("chatID")
    packaged_messages = current_user.package_chat_messages(chat_id)
    current_user.mark_chat_as_read(chat_id)
    return jsonify({"response": "success", "messages": packaged_messages})


@http.route("/get_chat_list", methods=["GET"])
def get_chat_list() -> Response:
    """Get the list of chats for the current player."""
    response = current_user.package_chat_list()
    return jsonify({"response": "success"} | response)


@http.route("/get_resource_data", methods=["GET"])
def get_resource_data() -> Response:
    """Get production rates and quantity on sale for every resource."""
    return jsonify(current_user.resources_on_sale)


@http.route("/get_chart_data", methods=["GET"])
def get_chart_data() -> Response | tuple:
    """Get the data for the overview charts."""

    def calculate_mean_subarrays(array: list, x: int) -> list:
        return [np.mean(array[i : i + x]) for i in range(0, len(array), x)]

    def concat_slices(dict1: dict, dict2: dict) -> None:
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
    total_t = engine.data["total_t"]
    rolling_history = current_user.rolling_history.get_data(t=total_t % 216 + 1)
    filename = f"instance/player_data/player_{current_user.id}.pck"
    with open(filename, "rb") as file:
        data = pickle.load(file)
    concat_slices(data, rolling_history)

    network_data = None
    if current_user.network is not None:
        filename = f"instance/network_data/{current_user.network.id}/time_series.pck"
        with open(filename, "rb") as file:
            network_data = pickle.load(file)
        concat_slices(network_data, current_user.network.rolling_history.get_data(t=total_t % 216 + 1))

    current_climate_data = engine.data["current_climate_data"].get_data(t=total_t % 216 + 1)
    with open("instance/server_data/climate_data.pck", "rb") as file:
        climate_data = pickle.load(file)
    concat_slices(climate_data, current_climate_data)

    return jsonify(
        {
            "total_t": total_t,
            "data": data,
            "network_data": network_data,
            "climate_data": climate_data,
            "cumulative_emissions": current_user.cumul_emissions.get_all(),
        },
    )


@http.route("/get_current_weather", methods=["GET"])
def get_current_weather() -> Response:
    """Get the current weather data including date, irradiance, wind speed, and river discharge."""
    return jsonify(energetica.utils.misc.package_weather_data(current_user))


@http.route("/get_network_capacities", methods=["GET"])
def get_network_capacities() -> Response | tuple:
    """Get the network capacities for the current player."""
    if current_user.network is None:
        return "", 404
    return jsonify(current_user.network.capacities.get_all())


@http.route("/get_market_data", methods=["GET"])
def get_market_data() -> Response | tuple:
    """Get the data for the market graph at a specific tick."""
    market_data = {}
    if current_user.network is None:
        return "", 404
    request_data = request.get_json()
    t = int(request_data["t"])
    filename_state = f"instance/network_data/{current_user.network.id}/charts/market_t{engine.data['total_t']-t}.pck"
    if Path(filename_state).is_file():
        with open(filename_state, "rb") as file:
            market_data = pickle.load(file)
            market_data["capacities"] = market_data["capacities"].to_dict(orient="list")
            market_data["demands"] = market_data["demands"].to_dict(orient="list")
    else:
        return "", 404
    return jsonify(market_data)


@http.route("/get_player_data", methods=["GET"])
def get_player_data() -> Response | tuple:
    """Get count of assets and config for this player."""
    if current_user.tile is None:
        return "", 404
    levels = current_user.get_lvls()
    capacities = current_user.capacities.get_all()
    return jsonify(
        {
            "levels": levels,
            "config": current_user.config,
            "capacities": capacities,
        },
    )


@http.route("/get_resource_reserves", methods=["GET"])
def get_resource_reserves() -> Response:
    """Get the natural resources reserves for this player."""
    reserves = current_user.get_reserves()
    return jsonify(reserves)


@http.route("/get_player_id", methods=["GET"])
def get_player_id() -> Response:
    """Get the id for this player."""
    return jsonify(current_user.id)


@http.route("/get_players", methods=["GET"])
def get_players() -> Response:
    """Get information for all players."""
    return jsonify(Player.package_all())


@http.route("/get_generation_priority", methods=["GET"])
def get_generation_priority() -> Response:
    """Get generation and demand priority for this player."""
    controllables_priorities = current_user.priorities_of_controllables.copy()
    for demand_type in current_user.priorities_of_demand:
        for i, facility in enumerate(controllables_priorities):
            if "demand-" in facility:
                price_i = current_user.network_prices.demand[facility[7:]]
            else:
                price_i = current_user.network_prices.supply[facility]
            if current_user.network_prices.demand[demand_type] < price_i:
                controllables_priorities.insert(i, "demand-" + demand_type)
                break
            if i + 1 == len(controllables_priorities):
                controllables_priorities.append("demand-" + demand_type)
                break
    return jsonify(current_user.list_of_renewables, controllables_priorities)


@http.route("/get_constructions", methods=["GET"])
def get_constructions() -> Response:
    """Get list of facilities under construction for this player."""
    projects = current_user.package_constructions()
    return jsonify(projects, current_user.constructions_by_priority, current_user.researches_by_priority)


@http.route("/get_shipments", methods=["GET"])
def get_shipments() -> Response:
    """Get list of shipments under way for this player."""
    return jsonify(current_user.package_shipments())


@http.route("/get_upcoming_achievements", methods=["GET"])
def get_upcoming_achievements() -> Response:
    """Get the upcoming achievements for this player."""
    return jsonify(current_user.package_upcoming_achievements())


@http.route("/get_scoreboard", methods=["GET"])
def get_scoreboard() -> Response:
    """Get the scoreboard data."""

    return jsonify(player.package_scoreboard())


@http.route("/get_quiz_question", methods=["GET"])
def get_quiz_question() -> Response:
    """Get the daily quiz question."""
    return jsonify(energetica.utils.misc.get_quiz_question(current_user))


@http.route("/submit_quiz_answer", methods=["POST"])
def submit_quiz_answer() -> Response:
    """Submit the daily quiz answer from a player."""
    request_data = request.get_json()
    answer = request_data["answer"]
    answer_correct = energetica.utils.misc.submit_quiz_answer(current_user, answer)
    return jsonify(
        {
            "response": "correct" if answer_correct else "incorrect",
            "question_data": energetica.utils.misc.get_quiz_question(current_user),
        },
    )


@http.route("/get_active_facilities", methods=["GET"])
def get_active_facilities() -> Response:
    """Get the active facilities for this player."""
    return jsonify(current_user.package_active_facilities())


@http.route("choose_location", methods=["POST"])
@log_action
def choose_location() -> Response:
    """Set the location for the player."""
    request_data = request.get_json()
    selected_id = request_data["selected_id"]
    tile = HexTile.get(selected_id + 1)
    if not tile:
        raise GameError("TileNotExist")  # TODO(mglst): ensure the frontend handles this
    energetica.utils.misc.confirm_location(player=Player.get(current_user.id), tile=tile)
    return jsonify({"response": "success"})


@http.route("/request_queue_project", methods=["POST"])
@log_action
def request_queue_project() -> Response | tuple:
    """Start a construction or research project for the player."""
    request_data = request.get_json()
    asset = request_data["facility"]
    force = request_data["force"]
    try:
        energetica.utils.assets.queue_project(
            player=Player.get(current_user.id),
            asset=asset,
            force=force,
        )
    except Confirm as confirm:
        return jsonify(
            {
                "response": "areYouSure",
                "capacity": confirm.capacity,
                "construction_power": confirm.construction_power,
            },
        ), 300

    return jsonify(
        {
            "response": "success",
            "money": current_user.money,
            "constructions": package_projects_data(current_user),
        },
    )


@http.route("/request_cancel_project", methods=["POST"])
@log_action
def request_cancel_project() -> Response | tuple:
    """Cancel an ongoing construction or upgrade."""
    request_data = request.get_json()
    construction_id = int(request_data["id"])
    construction = OngoingProject.get(int(construction_id))
    if construction is None or construction.player != current_user:
        return jsonify({"response": "constructionNotFound"}), 404
    force = request_data["force"]
    try:
        energetica.utils.assets.cancel_project(
            player=Player.get(current_user.id), construction=construction, force=force
        )
    except Confirm as confirm:
        return jsonify(
            {
                "response": "areYouSure",
                "refund": confirm.refund,
            },
        ), 300
    return jsonify(
        {
            "response": "success",
            "money": current_user.money,
            "constructions": package_projects_data(current_user),
        },
    )


@http.route("/request_toggle_pause_project", methods=["POST"])
@log_action
def request_pause_project() -> Response | tuple:
    """Pause or unpause an ongoing construction or upgrade."""
    request_data = request.get_json()
    construction_id = int(request_data["id"])
    construction = OngoingProject.get(int(construction_id))
    if construction is None or construction.player != current_user:
        return jsonify({"response": "constructionNotFound"}), 404
    energetica.utils.assets.toggle_pause_project(player=Player.get(current_user.id), construction=construction)
    return jsonify(
        {
            "response": "success",
            "constructions": package_projects_data(current_user),
        },
    )


@http.route("/request_decrease_project_priority", methods=["POST"])
@log_action
def request_decrease_project_priority() -> Response | tuple:
    """Change the order of ongoing constructions or upgrades."""
    request_data = request.get_json()
    construction_id = request_data["id"]
    construction = OngoingProject.get(int(construction_id))
    if construction is None or construction.player != current_user:
        return jsonify({"response": "constructionNotFound"}), 404
    energetica.utils.assets.decrease_project_priority(player=Player.get(current_user.id), construction=construction)
    return jsonify(
        {
            "response": "success",
            "constructions": package_projects_data(current_user),
        },
    )


@http.route("/request_upgrade_facility", methods=["POST"])
@log_action
def request_upgrade_facility() -> Response | tuple:
    """Upgrade a facility."""
    request_data = request.get_json()
    facility_id = request_data["facility_id"]
    facility = ActiveFacility.get(int(facility_id))
    if facility is None or facility.player != current_user:
        return jsonify({"response": "constructionNotFound"}), 404
    energetica.utils.assets.upgrade_facility(player=Player.get(current_user.id), facility=facility)
    return jsonify({"response": "success", "money": current_user.money})


@http.route("/request_upgrade_all_of_type", methods=["POST"])
@log_action
def request_upgrade_all_of_type() -> Response:
    """Upgrade all facilities of a certain type."""
    request_data = request.get_json()
    facility = request_data["facility"]
    energetica.utils.assets.upgrade_all_of_type(player=Player.get(current_user.id), facility_name=facility)
    return jsonify({"response": "success", "money": current_user.money})


@http.route("/request_dismantle_facility", methods=["POST"])
@log_action
def request_dismantle_facility() -> Response | tuple:
    """Dismantle a facility."""
    request_data = request.get_json()
    facility_id = request_data["facility_id"]
    facility = ActiveFacility.get(int(facility_id))
    if facility is None or facility.player != current_user:
        return jsonify({"response": "constructionNotFound"}), 404
    energetica.utils.assets.dismantle_facility(player=Player.get(current_user.id), facility=facility)
    return jsonify(
        {
            "response": "success",
            "facility_name": facility.name,
            "money": current_user.money,
        },
    )


@http.route("/request_dismantle_all_of_type", methods=["POST"])
@log_action
def request_dismantle_all_of_type() -> Response:
    """Dismantle all facilities of a certain type."""
    request_data = request.get_json()
    facility = request_data["facility"]
    energetica.utils.assets.dismantle_all_of_type(player=Player.get(current_user.id), facility_name=facility)
    return jsonify({"response": "success", "money": current_user.money})


@http.route("/change_network_prices", methods=["POST"])
@log_action
def change_network_prices() -> Response | tuple:
    """Change the prices for anything on the network."""
    if not current_user.is_in_network:
        return jsonify({"response": "notAuthorized"}), 404
    updated_prices = request.get_json()["prices"]
    if not all(key in ["supply", "demand"] for key in updated_prices.keys()):
        raise GameError("malformedRequest")
    energetica.utils.network_helpers.set_network_prices(
        current_user,
        updated_supply_prices=updated_prices["supply"],
        updated_demand_prices=updated_prices["demand"],
    )
    return jsonify({"response": "success"})


@http.route("/request_change_facility_priority", methods=["POST"])
@log_action
def request_change_facility_priority() -> Response | tuple:
    """Change the generation priority."""
    if "Unlock Network" not in current_user.achievements:
        return jsonify({"response": "notAuthorized"}), 404
    request_data = request.get_json()
    priority = request_data["priority"]
    energetica.utils.network_helpers.change_facility_priority(player=Player.get(current_user.id), priority=priority)
    return jsonify({"response": "success"})


@http.route("/put_resource_on_sale", methods=["POST"])
@log_action
def put_resource_on_sale() -> Response:
    """Put a resource on sale."""
    request_data = request.form
    resource = request_data["resource"]
    quantity = float(request_data["quantity"]) * 1000
    price = float(request_data["price"]) / 1000
    try:
        energetica.utils.resource_market.put_resource_on_market(current_user, resource, quantity, price)
    except GameError as game_exception:
        if game_exception.exception_type != "notEnoughResource":
            raise
        flash_error(f"You have not enough {resource} available")
    else:
        flash(
            f"You put {quantity/1000}t of {resource} on sale for "
            f"{price*1000}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>/t",
            category="message",
        )
    return redirect("/resource_market", code=303)


@http.route("/buy_resource", methods=["POST"])
@log_action
def buy_resource() -> Response | tuple:
    """Buy a resource from the market."""
    request_data = request.get_json()
    sale_id = int(request_data["id"])
    quantity = float(request_data["quantity"]) * 1000
    sale = ResourceOnSale.get(int(sale_id))
    if sale is None:
        return jsonify({"response": "saleNotFound"}), 404
    energetica.utils.resource_market.buy_resource_from_market(current_user, quantity, sale)
    if current_user == sale.player:
        return jsonify(
            {
                "response": "removedFromMarket",
                "quantity": quantity,
                "available_quantity": sale.quantity,
                "resource": sale.resource,
            },
        )
    return jsonify(
        {
            "response": "success",
            "resource": sale.resource,
            "total_price": sale.price * quantity,
            "quantity": quantity,
            "seller": sale.player.username,
            "available_quantity": sale.quantity,
            "shipments": current_user.package_shipments(),
        },
    )


@http.route("join_network", methods=["POST"])
@log_action
def join_network() -> Response:
    """Join a network."""
    request_data = request.form
    network_id = int(request_data["choose_network"])
    network = energetica.utils.network_helpers.join_network(current_user, Network.get(network_id))
    flash(f"You joined the network {network.name}", category="message")
    engine.log(f"{current_user.username} joined the network {current_user.network.name}")
    return redirect("/network", code=303)


@http.route("create_network", methods=["POST"])
@log_action
def create_network() -> Response:
    """Create a network."""
    request_data = request.form
    network_name = request_data["network_name"]
    try:
        energetica.utils.network_helpers.create_network(current_user, network_name)
    except GameError as game_exception:
        match game_exception.exception_type:
            case "nameLengthInvalid":
                flash("Network name must be between 3 and 40 characters", category="error")
            case "nameAlreadyUsed":
                flash("A network with this name already exists", category="error")
        raise
    flash(f"You created the network {network_name}", category="message")
    return redirect("/network", code=303)


@http.route("leave_network", methods=["POST"])
@log_action
def leave_network() -> Response | tuple:
    """Leave the current network."""
    network = current_user.network
    if network is None:
        return jsonify({"response": "notInNetwork"}), 404
    energetica.utils.network_helpers.leave_network(current_user)
    flash(f"You left network {network.name}", category="message")
    return redirect("/network", code=303)


@http.route("hide_chat_disclaimer", methods=["GET"])
def hide_chat_disclaimer() -> Response:
    """Permanently hide the chat disclaimer."""
    energetica.utils.chat.hide_chat_disclaimer(current_user)
    return jsonify({"response": "success"})


@http.route("create_chat", methods=["POST"])
def create_chat() -> Response:
    """Create a chat with one other player."""
    request_data = request.get_json()
    buddy_id = request_data["buddy_id"]
    buddy = Player.get(buddy_id)
    if buddy is None:
        raise GameError("playerNotFound")  # TODO(mglst): ensure the frontend handles this
    energetica.utils.chat.create_chat(current_user, None, {current_user, buddy})
    return jsonify({"response": "success"})


@http.route("create_group_chat", methods=["POST"])
def create_group_chat() -> Response:
    """Create a group chat."""
    request_data = request.get_json()
    chat_title = request_data["chat_title"]
    group_members = {current_user, *list(map(Player.get, request_data["group_members"]))}
    energetica.utils.chat.create_chat(current_user, chat_title, group_members)
    return jsonify({"response": "success"})


@http.route("new_message", methods=["POST"])
def new_message() -> Response | tuple:
    """Send a message."""
    request_data = request.get_json()
    message = request_data["new_message"]
    chat_id = int(request_data["chat_id"])
    chat = Chat.get(chat_id)
    if chat is None:
        return jsonify({"response": "NoChatID"}), 403
    energetica.utils.chat.add_message(current_user, message, chat)
    return jsonify({"response": "success"})


@http.route("change_graph_view", methods=["POST"])
def change_graph_view() -> Response:
    """Change the view mode for the graphs (basic, normal, expert)."""
    request_data = request.get_json()
    view = request_data["view"]
    current_user.change_graph_view(view)
    return jsonify({"response": "success"})


@http.route("test_notification", methods=["GET"])
def test_notification() -> Response:
    """Send a dummy notification to the player."""
    notification_data = {
        "title": "Test notification",
        "body": f"{engine.data['total_t']} ({datetime.now()})",
    }
    current_user.send_notification(notification_data)
    return jsonify({"response": "success"})


@http.route("set_notification_preferences", methods=["POST"])
def set_notification_preferences() -> Response:
    """Set notification preferences for a player."""
    preferences = request.get_json()["notification_preferences"]
    current_user.notification_preferences = preferences
    return jsonify({"response": "success"})
