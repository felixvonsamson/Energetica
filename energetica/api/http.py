"""These functions make the link between the website and the database."""

import pickle
from collections.abc import Callable
from datetime import datetime
from functools import wraps
from pathlib import Path
from typing import TYPE_CHECKING

import numpy as np
from flask import Blueprint, flash, g, jsonify, redirect, request
from flask.ctx import _AppCtxGlobals
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
from energetica.database.ongoing_project import OngoingProject
from energetica.database.player import Player
from energetica.database.resource_on_sale import ResourceOnSale
from energetica.enums import (
    ExtractionFacilityType,
    Fuel,
    PowerFacilityType,
    Renewable,
    StorageFacilityType,
    str_to_project_type,
)
from energetica.game_engine import Confirm
from energetica.game_error import GameError
from energetica.globals import engine
from energetica.utils.assets import package_projects_data
from energetica.utils.misc import flash_error

if TYPE_CHECKING:
    # The only purpose of this is to make the type checker happy. It tells the type checker that the `g` object
    # has an attribute `player` of type `Player`. It does nothing at runtime

    class _AppCtxGlobals(_AppCtxGlobals):  # type: ignore[no-redef]
        player: Player

    g: _AppCtxGlobals  # type: ignore[no-redef]


http = Blueprint("http", __name__)


def log_action(func: Callable) -> Callable:
    """Log all endpoint actions of the players."""

    @wraps(func)
    def wrapper(*args, **kwargs):
        if request.method != "POST":
            return func(*args, **kwargs)

        start = datetime.now()
        try:
            with engine.lock:
                response = func(*args, **kwargs)
            response, status_code = response if isinstance(response, tuple) else (response, response.status_code)
        except GameError as game_exception:
            response, status_code = jsonify({"response": game_exception.exception_type, **game_exception.kwargs}), 403

        log_entry = {
            "timestamp": start.isoformat(),
            "elapsed": (datetime.now() - start).total_seconds(),
            "ip": request.headers.get("X-Forwarded-For", request.remote_addr),
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
        engine.log_action(log_entry)
        return response, status_code

    return wrapper


@http.before_request
def restrict_access_during_simulation():
    """Restrict access to the API during the simulation."""
    if (
        engine.serve_local
        and request.method == "POST"
        and request.headers.get("X-Forwarded-For", request.remote_addr) != "127.0.0.1"
    ):
        return "Service temporarily unavailable. Please try again in a few seconds", 503


@http.before_request
@login_required
def check_if_logged_in():
    """Function that is called before every request and ensures that the player is logged in. (FLASK)"""
    g.player = current_user._get_current_object()  # pylint: disable=protected-access


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
    g.player.delete_notification(notification_id)
    return jsonify({"response": "success"})


@http.route("/request_marked_as_read", methods=["POST"])
def request_marked_as_read() -> Response:
    """Mark all notification as read."""
    g.player.notifications_read()
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
            "solar": tile.potentials[Renewable.SOLAR],
            "wind": tile.potentials[Renewable.WIND],
            "hydro": tile.potentials[Renewable.HYDRO],
            "coal": tile.fuel_reserves[Fuel.COAL],
            "gas": tile.fuel_reserves[Fuel.GAS],
            "uranium": tile.fuel_reserves[Fuel.URANIUM],
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
    networks = {network.id: network.name for network in Network.all()}
    return jsonify(networks)


@http.route("/get_chat_messages", methods=["GET"])
def get_chat_messages() -> Response | tuple:
    """Get the last 20 messages from a chat and returns it as a list."""
    chat_id = request.args.get("chatID")
    if chat_id is None:
        return jsonify({"response": "noChatID"}), 400
    chat = Chat.get(int(chat_id))
    if chat is None:
        return jsonify({"response": "chatNotFound"}), 404
    packaged_messages = g.player.package_chat_messages(chat)
    g.player.mark_chat_as_read(chat)
    return jsonify({"response": "success", "messages": packaged_messages})


@http.route("/get_chat_list", methods=["GET"])
def get_chat_list() -> Response:
    """Get the list of chats for the current player."""
    response = g.player.package_chat_list()
    return jsonify({"response": "success"} | response)


@http.route("/get_resource_data", methods=["GET"])
def get_resource_data() -> Response:
    """Get production rates and quantity on sale for every resource."""
    return jsonify(g.player.resources_on_sale)


@http.route("/get_chart_data", methods=["GET"])
def get_chart_data() -> Response | tuple:
    """Get the data for the overview charts."""

    def calculate_mean_subarrays(array: list, x: int) -> list:
        return [np.mean(array[i : i + x]) for i in range(0, len(array), x)]

    def concat_slices(dict1: dict, dict2: dict) -> None:
        for key, value in dict2.items():
            for sub_key, array2 in value.items():
                if sub_key not in dict1[key]:
                    dict1[key][sub_key] = [[0.0] * 360 for _ in range(5)]
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

    if g.player.tile is None:
        return "", 404
    total_t = engine.total_t
    rolling_history = g.player.rolling_history.get_data(t=total_t % 216 + 1)
    filename = f"instance/data/players/player_{g.player.id}.pck"
    with open(filename, "rb") as file:
        data = pickle.load(file)
    concat_slices(data, rolling_history)

    network_data = None
    if g.player.network is not None:
        filename = f"instance/data/networks/{g.player.network.id}/time_series.pck"
        with open(filename, "rb") as file:
            network_data = pickle.load(file)
        concat_slices(network_data, g.player.network.rolling_history.get_data(t=total_t % 216 + 1))

    current_climate_data = engine.current_climate_data.get_data(t=total_t % 216 + 1)
    with open("instance/data/servers/climate_data.pck", "rb") as file:
        climate_data = pickle.load(file)
    concat_slices(climate_data, current_climate_data)

    return jsonify(
        {
            "total_t": total_t,
            "data": data,
            "network_data": network_data,
            "climate_data": climate_data,
            "cumulative_emissions": g.player.cumul_emissions.get_all(),
        },
    )


@http.route("/get_current_weather", methods=["GET"])
def get_current_weather() -> Response:
    """Get the current weather data including date, irradiance, wind speed, and river discharge."""
    return jsonify(energetica.utils.misc.package_weather_data(g.player))


@http.route("/get_network_capacities", methods=["GET"])
def get_network_capacities() -> Response | tuple:
    """Get the network capacities for the current player."""
    if g.player.network is None:
        return "", 404
    return jsonify(g.player.network.capacities.get_all())


@http.route("/get_market_data", methods=["GET"])
def get_market_data() -> Response | tuple:
    """Get the data for the market graph at a specific tick."""
    market_data = {}
    if g.player.network is None:
        return "", 404
    request_data = request.get_json()
    t = int(request_data["t"])
    filename_state = f"instance/data/networks/{g.player.network.id}/charts/market_t{engine.total_t - t}.pck"
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
    if g.player.tile is None:
        return "", 404
    levels = g.player.get_lvls()
    capacities = g.player.capacities.get_all()
    return jsonify(
        {
            "levels": levels,
            "config": g.player.config,
            "capacities": capacities,
        },
    )


@http.route("/get_resource_reserves", methods=["GET"])
def get_resource_reserves() -> Response:
    """Get the natural resources reserves for this player."""
    if g.player.tile is None:
        raise GameError("noTile")
    reserves = g.player.tile.fuel_reserves
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
    return jsonify(g.player.network_prices.get_sorted_renewables(), g.player.network_prices.get_facility_priorities())


@http.route("/get_constructions", methods=["GET"])
def get_constructions() -> Response:
    """Get list of facilities under construction for this player."""
    projects = g.player.package_constructions()
    constructions_by_priority = [construction.id for construction in g.player.constructions_by_priority]
    researches_by_priority = [research.id for research in g.player.researches_by_priority]
    return jsonify(projects, constructions_by_priority, researches_by_priority)


@http.route("/get_shipments", methods=["GET"])
def get_shipments() -> Response:
    """Get list of shipments under way for this player."""
    return jsonify(g.player.package_shipments())


@http.route("/get_upcoming_achievements", methods=["GET"])
def get_upcoming_achievements() -> Response:
    """Get the upcoming achievements for this player."""
    return jsonify(g.player.package_upcoming_achievements())


@http.route("/get_scoreboard", methods=["GET"])
def get_scoreboard() -> Response:
    """Get the scoreboard data."""
    return jsonify(g.player.package_scoreboard())


@http.route("/get_quiz_question", methods=["GET"])
def get_quiz_question() -> Response:
    """Get the daily quiz question."""
    return jsonify(energetica.utils.misc.get_quiz_question(g.player))


@http.route("/submit_quiz_answer", methods=["POST"])
def submit_quiz_answer() -> Response:
    """Submit the daily quiz answer from a player."""
    request_data = request.get_json()
    answer = request_data["answer"]
    answer_correct = energetica.utils.misc.submit_quiz_answer(g.player, answer)
    return jsonify(
        {
            "response": "correct" if answer_correct else "incorrect",
            "question_data": energetica.utils.misc.get_quiz_question(g.player),
        },
    )


@http.route("/get_active_facilities", methods=["GET"])
def get_active_facilities() -> Response:
    """Get the active facilities for this player."""
    return jsonify(g.player.package_active_facilities())


@http.route("choose_location", methods=["POST"])
@log_action
def choose_location() -> Response:
    """Set the location for the player."""
    request_data = request.get_json()
    selected_id = request_data["selected_id"]
    tile = HexTile.getitem(selected_id + 1)
    energetica.utils.misc.confirm_location(player=g.player, tile=tile)
    return jsonify({"response": "success"})


@http.route("/request_queue_project", methods=["POST"])
@log_action
def request_queue_project() -> Response | tuple:
    """Start a construction or research project for the player."""
    request_data = request.get_json()
    asset = request_data["facility"]
    project_type = str_to_project_type[asset]
    force = request_data["force"]
    try:
        energetica.utils.assets.queue_project(
            player=g.player,
            project_type=project_type,
            force=force,
        )
    except Confirm as confirm:
        return jsonify(
            {
                "response": "areYouSure",
                "capacity": confirm.__getattribute__("capacity"),
                "construction_power": confirm.__getattribute__("construction_power"),
            },
        ), 300

    return jsonify(
        {
            "response": "success",
            "money": g.player.money,
            "constructions": package_projects_data(g.player),
        },
    )


@http.route("/request_cancel_project", methods=["POST"])
@log_action
def request_cancel_project() -> Response | tuple:
    """Cancel an ongoing projects."""
    request_data = request.get_json()
    project_id = int(request_data["id"])
    project = OngoingProject.get(int(project_id))
    if project is None or project.player != g.player:
        return jsonify({"response": "projectNotFound"}), 404
    force = request_data["force"]
    try:
        energetica.utils.assets.cancel_project(player=g.player, project=project, force=force)
    except Confirm as confirm:
        return jsonify(
            {
                "response": "areYouSure",
                "refund": confirm.__getattribute__("refund"),
            },
        ), 300
    return jsonify(
        {
            "response": "success",
            "money": g.player.money,
            "projects": package_projects_data(g.player),
        },
    )


@http.route("/request_toggle_pause_project", methods=["POST"])
@log_action
def request_pause_project() -> Response | tuple:
    """Pause or unpause an ongoing project."""
    request_data = request.get_json()
    project_id = int(request_data["id"])
    project = OngoingProject.get(int(project_id))
    if project is None or project.player != g.player:
        return jsonify({"response": "projectNotFound"}), 404
    energetica.utils.assets.toggle_pause_project(player=g.player, project=project)
    return jsonify(
        {
            "response": "success",
            "projects": package_projects_data(g.player),
        },
    )


@http.route("/request_decrease_project_priority", methods=["POST"])
@log_action
def request_decrease_project_priority() -> Response | tuple:
    """Change the order of ongoing projects."""
    request_data = request.get_json()
    project_id = request_data["id"]
    project = OngoingProject.get(int(project_id))
    if project is None or project.player != g.player:
        return jsonify({"response": "projectNotFound"}), 404
    energetica.utils.assets.decrease_project_priority(player=g.player, project=project)
    return jsonify(
        {
            "response": "success",
            "projects": package_projects_data(g.player),
        },
    )


@http.route("/request_upgrade_facility", methods=["POST"])
@log_action
def request_upgrade_facility() -> Response | tuple:
    """Upgrade a facility."""
    request_data = request.get_json()
    facility_id = request_data["facility_id"]
    facility = ActiveFacility.get(int(facility_id))
    if facility is None or facility.player != g.player:
        return jsonify({"response": "facilityNotFound"}), 404
    energetica.utils.assets.upgrade_facility(player=g.player, facility=facility)
    return jsonify({"response": "success", "money": g.player.money})


@http.route("/request_upgrade_all_of_type", methods=["POST"])
@log_action
def request_upgrade_all_of_type() -> Response | tuple:
    """Upgrade all facilities of a certain type."""
    request_data = request.get_json()
    facility_type = str_to_project_type[request_data["facility"]]
    if not isinstance(facility_type, PowerFacilityType | StorageFacilityType | ExtractionFacilityType):
        return jsonify({"response": "malformedRequest"}), 400
    energetica.utils.assets.upgrade_all_of_type(player=g.player, facility_type=facility_type)
    return jsonify({"response": "success", "money": g.player.money})


@http.route("/request_dismantle_facility", methods=["POST"])
@log_action
def request_dismantle_facility() -> Response | tuple:
    """Dismantle a facility."""
    request_data = request.get_json()
    facility_id = request_data["facility_id"]
    facility = ActiveFacility.get(int(facility_id))
    if facility is None or facility.player != g.player:
        return jsonify({"response": "projectNotFound"}), 404
    energetica.utils.assets.dismantle_facility(player=g.player, facility=facility)
    return jsonify(
        {
            "response": "success",
            "facility_name": facility.facility_type,
            "money": g.player.money,
        },
    )


@http.route("/request_dismantle_all_of_type", methods=["POST"])
@log_action
def request_dismantle_all_of_type() -> Response:
    """Dismantle all facilities of a certain type."""
    request_data = request.get_json()
    facility = request_data["facility"]
    energetica.utils.assets.dismantle_all_of_type(player=g.player, facility_type=facility)
    return jsonify({"response": "success", "money": g.player.money})


@http.route("/change_network_prices", methods=["POST"])
@log_action
def change_network_prices() -> Response | tuple:
    """Change the prices for anything on the network."""
    if not g.player.is_in_network:
        return jsonify({"response": "notAuthorized"}), 404
    updated_prices = request.get_json()["prices"]
    if not all(key in ["supply", "demand"] for key in updated_prices.keys()):
        raise GameError("malformedRequest")
    g.player.network_prices.update(
        updated_bids=updated_prices["supply"],
        updated_asks=updated_prices["demand"],
    )
    engine.log(f"{g.player.username} updated their prices")
    return jsonify({"response": "success"})


@http.route("/request_change_facility_priority", methods=["POST"])
@log_action
def request_change_facility_priority() -> Response | tuple:
    """Change the generation priority."""
    if not g.player.achievements["network"]:
        return jsonify({"response": "notAuthorized"}), 404
    request_data = request.get_json()
    priority = request_data["priority"]
    g.player.network_prices.change_facility_priority(new_priority=priority)
    return jsonify({"response": "success"})


@http.route("/put_resource_on_sale", methods=["POST"])
@log_action
def put_resource_on_sale() -> Response:
    """Put a resource on sale."""
    request_data = request.form
    resource = Fuel(request_data["resource"])
    quantity = float(request_data["quantity"]) * 1000
    price = float(request_data["price"]) / 1000
    try:
        energetica.utils.resource_market.put_resource_on_market(g.player, resource, quantity, price)
    except GameError as game_exception:
        if game_exception.exception_type != "notEnoughResource":
            raise
        flash_error(f"You have not enough {resource} available")
    else:
        flash(
            f"You put {quantity / 1000}t of {resource} on sale for "
            f"{price * 1000}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>/t",
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
    energetica.utils.resource_market.buy_resource_from_market(g.player, quantity, sale)
    if g.player == sale.player:
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
            "shipments": g.player.package_shipments(),
        },
    )


@http.route("join_network", methods=["POST"])
@log_action
def join_network() -> Response:
    """Join a network."""
    request_data = request.form
    network_id = int(request_data["choose_network"])
    network = energetica.utils.network_helpers.join_network(g.player, Network.get(network_id))
    flash(f"You joined the network {network.name}", category="message")
    engine.log(f"{g.player.username} joined the network {network.name}")
    return redirect("/network", code=303)


@http.route("create_network", methods=["POST"])
@log_action
def create_network() -> Response:
    """Create a network."""
    request_data = request.form
    network_name = request_data["network_name"]
    try:
        energetica.utils.network_helpers.create_network(g.player, network_name)
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
    network = g.player.network
    if network is None:
        return jsonify({"response": "notInNetwork"}), 404
    energetica.utils.network_helpers.leave_network(g.player)
    flash(f"You left network {network.name}", category="message")
    return redirect("/network", code=303)


@http.route("hide_chat_disclaimer", methods=["GET"])
def hide_chat_disclaimer() -> Response:
    """Permanently hide the chat disclaimer."""
    energetica.utils.chat.hide_chat_disclaimer(g.player)
    return jsonify({"response": "success"})


@http.route("create_chat", methods=["POST"])
def create_chat() -> Response:
    """Create a chat with one other player."""
    request_data = request.get_json()
    buddy_id = request_data["buddy_id"]
    buddy = Player.getitem(buddy_id)
    energetica.utils.chat.create_chat(g.player, None, {g.player, buddy})
    return jsonify({"response": "success"})


@http.route("create_group_chat", methods=["POST"])
def create_group_chat() -> Response:
    """Create a group chat."""
    request_data = request.get_json()
    chat_title = request_data["chat_title"]
    group_members = {g.player, *list(map(Player.getitem, request_data["group_members"]))}
    energetica.utils.chat.create_chat(g.player, chat_title, group_members)
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
    energetica.utils.chat.add_message(g.player, message, chat)
    return jsonify({"response": "success"})


@http.route("change_graph_view", methods=["POST"])
def change_graph_view() -> Response:
    """Change the view mode for the graphs (basic, normal, expert)."""
    request_data = request.get_json()
    view = request_data["view"]
    g.player.change_graph_view(view)
    return jsonify({"response": "success"})


@http.route("test_notification", methods=["GET"])
def test_notification() -> Response:
    """Send a dummy browser notification to the player."""
    g.player.notify("Test notification", f"{engine.total_t} ({datetime.now()})")
    return jsonify({"response": "success"})


@http.route("set_notification_preferences", methods=["POST"])
def set_notification_preferences() -> Response:
    """Set notification preferences for a player."""
    preferences = request.get_json()["notification_preferences"]
    g.player.notification_preferences = preferences
    return jsonify({"response": "success"})
