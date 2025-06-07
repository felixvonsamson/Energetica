import pickle
from datetime import datetime
from pathlib import Path
from typing import Annotated

import numpy as np
from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse, RedirectResponse

import energetica.utils.assets
import energetica.utils.chat
import energetica.utils.map_helpers
import energetica.utils.misc
import energetica.utils.network_helpers
import energetica.utils.resource_market
from energetica.auth import get_current_user
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

# TODO: migrate all these routes to native FastAPI routes
todo_router = APIRouter(prefix="", tags=["Flask Migration"])


@todo_router.post("/request_delete_notification")
async def request_delete_notification(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """
    Delete a notification from the player's notification list.

    Request Payload:
        {
            "id": int  # The ID of the notification to be deleted
        }
    """
    request_data = await request.json()
    notification_id = request_data["id"]
    user.delete_notification(notification_id)
    return {"response": "success"}


@todo_router.post("/request_marked_as_read")
def request_marked_as_read(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Mark all notification as read."""
    user.notifications_read()
    return {"response": "success"}


@todo_router.get("/get_const_config")
def get_const_config():  # noqa: ANN201
    """Get constant config data."""
    return engine.const_config


@todo_router.get("/get_wind_power_curve")
def get_wind_power_curve():  # noqa: ANN201
    """Get the wind power curve."""
    return wind_power_curve


# gets the map data from the database and returns it as a array of dictionaries :
@todo_router.get("/get_map")
def get_map():  # noqa: ANN201
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
    return hex_list


@todo_router.get("/get_networks")
def get_networks():  # noqa: ANN201
    """Get all the network names and returns it as a list."""
    networks = {network.id: network.name for network in Network.all()}
    return networks


@todo_router.get("/get_chat_messages")
async def get_chat_messages(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Get the last 20 messages from a chat and returns it as a list."""
    request_data = await request.json()
    chat = Chat.get(int(request_data["chatID"]))
    if chat is None:
        return JSONResponse({"response": "chatNotFound"}, status_code=status.HTTP_404_NOT_FOUND)
    packaged_messages = user.package_chat_messages(chat)
    user.mark_chat_as_read(chat)
    return {"response": "success", "messages": packaged_messages}


@todo_router.get("/get_chat_list")
def get_chat_list(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get the list of chats for the current player."""
    response = user.package_chat_list()
    return {"response": "success"} | response


@todo_router.get("/get_resource_data")
def get_resource_data(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get production rates and quantity on sale for every resource."""
    return user.resources_on_sale


@todo_router.get("/get_chart_data")
def get_chart_data(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
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

    if user.tile is None:
        return "", 404
    total_t = engine.total_t
    rolling_history = user.rolling_history.get_data(t=total_t % 216 + 1)
    filename = f"instance/data/players/player_{user.id}.pck"
    with open(filename, "rb") as file:
        data = pickle.load(file)
    concat_slices(data, rolling_history)

    network_data = None
    if user.network is not None:
        filename = f"instance/data/networks/{user.network.id}/time_series.pck"
        with open(filename, "rb") as file:
            network_data = pickle.load(file)
        concat_slices(network_data, user.network.rolling_history.get_data(t=total_t % 216 + 1))

    current_climate_data = engine.current_climate_data.get_data(t=total_t % 216 + 1)
    with open("instance/data/servers/climate_data.pck", "rb") as file:
        climate_data = pickle.load(file)
    concat_slices(climate_data, current_climate_data)

    return (
        {
            "total_t": total_t,
            "data": data,
            "network_data": network_data,
            "climate_data": climate_data,
            "cumulative_emissions": user.cumul_emissions.get_all(),
        },
    )


@todo_router.get("/get_current_weather")
def get_current_weather(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get the current weather data including date, irradiance, wind speed, and river discharge."""
    return energetica.utils.misc.package_weather_data(user)


@todo_router.get("/get_network_capacities")
def get_network_capacities(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get the network capacities for the current player."""
    if user.network is None:
        return "", 404
    return user.network.capacities.get_all()


@todo_router.get("/get_market_data")
def get_market_data(user: Annotated[Player, Depends(get_current_user)], t: int):  # noqa: ANN201
    """Get the data for the market graph at a specific tick."""
    market_data = {}
    if user.network is None:
        return "", 404
    filename_state = f"instance/data/networks/{user.network.id}/charts/market_t{engine.total_t - t}.pck"
    if Path(filename_state).is_file():
        with open(filename_state, "rb") as file:
            market_data = pickle.load(file)
            market_data["capacities"] = market_data["capacities"].to_dict(orient="list")
            market_data["demands"] = market_data["demands"].to_dict(orient="list")
    else:
        return "", 404
    return market_data


@todo_router.get("/get_player_data")
def get_player_data(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get count of assets and config for this player."""
    if user.tile is None:
        return "", 404
    levels = user.get_lvls()
    capacities = user.capacities.get_all()
    return (
        {
            "levels": levels,
            "config": user.config,
            "capacities": capacities,
        },
    )


@todo_router.get("/get_resource_reserves")
def get_resource_reserves(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get the natural resources reserves for this player."""
    if user.tile is None:
        raise GameError("noTile")
    reserves = user.tile.fuel_reserves
    return reserves


@todo_router.get("/get_player_id")
def get_player_id(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get the id for this player."""
    return user.id


@todo_router.get("/get_players")
def get_players():  # noqa: ANN201
    """Get information for all players."""
    return Player.package_all()


@todo_router.get("/get_generation_priority")
def get_generation_priority(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get generation and demand priority for this player."""
    return (user.network_prices.get_sorted_renewables(), user.network_prices.get_facility_priorities())


@todo_router.get("/get_constructions")
def get_constructions(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get list of facilities under construction for this player."""
    projects = user.package_constructions()
    constructions_by_priority = [construction.id for construction in user.constructions_by_priority]
    researches_by_priority = [research.id for research in user.researches_by_priority]
    return (projects, constructions_by_priority, researches_by_priority)


@todo_router.get("/get_shipments")
def get_shipments(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get list of shipments under way for this player."""
    return user.package_shipments()


@todo_router.get("/get_upcoming_achievements")
def get_upcoming_achievements(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get the upcoming achievements for this player."""
    return user.package_upcoming_achievements()


@todo_router.get("/get_scoreboard")
def get_scoreboard(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get the scoreboard data."""
    return user.package_scoreboard()


@todo_router.get("/get_quiz_question")
def get_quiz_question(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get the daily quiz question."""
    return energetica.utils.misc.get_quiz_question(user)


@todo_router.post("/submit_quiz_answer")
async def submit_quiz_answer(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Submit the daily quiz answer from a player."""
    # TODO: even for correct answers, the frontend displays "Incorrect answer! Try again tomorrow."
    request_data = await request.json()
    answer = request_data["answer"]
    answer_correct = energetica.utils.misc.submit_quiz_answer(user, answer)
    return (
        {
            "response": "correct" if answer_correct else "incorrect",
            "question_data": energetica.utils.misc.get_quiz_question(user),
        },
    )


@todo_router.get("/get_active_facilities")
def get_active_facilities(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get the active facilities for this player."""
    return user.package_active_facilities()


@todo_router.post("/choose_location")
async def choose_location(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Set the location for the player."""
    request_data = await request.json()
    selected_id = request_data["selected_id"]
    tile = HexTile.getitem(selected_id + 1)
    energetica.utils.map_helpers.confirm_location(player=user, tile=tile)
    return {"response": "success"}


@todo_router.post("/request_queue_project")
async def request_queue_project(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Start a construction or research project for the player."""
    request_data = await request.json()
    asset = request_data["facility"]
    project_type = str_to_project_type[asset]
    force = request_data["force"]
    try:
        energetica.utils.assets.queue_project(
            player=user,
            project_type=project_type,
            force=force,
        )
    except Confirm as confirm:
        return (
            {
                "response": "areYouSure",
                "capacity": confirm.__getattribute__("capacity"),
                "construction_power": confirm.__getattribute__("construction_power"),
            },
        ), 300

    return (
        {
            "response": "success",
            "money": user.money,
            "constructions": package_projects_data(user),
        },
    )


@todo_router.post("/request_cancel_project")
async def request_cancel_project(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Cancel an ongoing projects."""
    request_data = await request.json()
    project_id = int(request_data["id"])
    project = OngoingProject.get(int(project_id))
    if project is None or project.player != user:
        return ({"response": "projectNotFound"}), 404
    force = request_data["force"]
    try:
        energetica.utils.assets.cancel_project(player=user, project=project, force=force)
    except Confirm as confirm:
        return (
            {
                "response": "areYouSure",
                "refund": confirm.__getattribute__("refund"),
            },
        ), 300
    return (
        {
            "response": "success",
            "money": user.money,
            "projects": package_projects_data(user),
        },
    )


@todo_router.post("/request_toggle_pause_project")
async def request_pause_project(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Pause or unpause an ongoing project."""
    request_data = await request.json()
    project_id = int(request_data["id"])
    project = OngoingProject.get(int(project_id))
    if project is None or project.player != user:
        return ({"response": "projectNotFound"}), 404
    energetica.utils.assets.toggle_pause_project(player=user, project=project)
    return (
        {
            "response": "success",
            "projects": package_projects_data(user),
        },
    )


@todo_router.post("/request_decrease_project_priority")
async def request_decrease_project_priority(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Change the order of ongoing projects."""
    request_data = await request.json()
    project_id = request_data["id"]
    project = OngoingProject.get(int(project_id))
    if project is None or project.player != user:
        return ({"response": "projectNotFound"}), 404
    energetica.utils.assets.decrease_project_priority(player=user, project=project)
    return (
        {
            "response": "success",
            "projects": package_projects_data(user),
        },
    )


@todo_router.post("/request_upgrade_facility")
async def request_upgrade_facility(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Upgrade a facility."""
    request_data = await request.json()
    facility_id = request_data["facility_id"]
    facility = ActiveFacility.get(int(facility_id))
    if facility is None or facility.player != user:
        return ({"response": "facilityNotFound"}), 404
    energetica.utils.assets.upgrade_facility(player=user, facility=facility)
    return {"response": "success", "money": user.money}


@todo_router.post("/request_upgrade_all_of_type")
async def request_upgrade_all_of_type(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Upgrade all facilities of a certain type."""
    request_data = await request.json()
    facility_type = str_to_project_type[request_data["facility"]]
    if not isinstance(facility_type, PowerFacilityType | StorageFacilityType | ExtractionFacilityType):
        return ({"response": "malformedRequest"}), 400
    energetica.utils.assets.upgrade_all_of_type(player=user, facility_type=facility_type)
    return {"response": "success", "money": user.money}


@todo_router.post("/request_dismantle_facility")
async def request_dismantle_facility(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Dismantle a facility."""
    request_data = await request.json()
    facility_id = request_data["facility_id"]
    facility = ActiveFacility.get(int(facility_id))
    if facility is None or facility.player != user:
        return ({"response": "projectNotFound"}), 404
    energetica.utils.assets.dismantle_facility(player=user, facility=facility)
    return (
        {
            "response": "success",
            "facility_name": facility.facility_type,
            "money": user.money,
        },
    )


@todo_router.post("/request_dismantle_all_of_type")
async def request_dismantle_all_of_type(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Dismantle all facilities of a certain type."""
    request_data = await request.json()
    facility = request_data["facility"]
    energetica.utils.assets.dismantle_all_of_type(player=user, facility_type=facility)
    return {"response": "success", "money": user.money}


@todo_router.post("/change_network_prices")
async def change_network_prices(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Change the prices for anything on the network."""
    if not user.is_in_network:
        return ({"response": "notAuthorized"}), 404
    request_data = await request.json()
    updated_prices = request_data["prices"]
    if not all(key in ["supply", "demand"] for key in updated_prices.keys()):
        raise GameError("malformedRequest")
    user.network_prices.update(
        updated_bids=updated_prices["supply"],
        updated_asks=updated_prices["demand"],
    )
    engine.log(f"{user.username} updated their prices")
    return {"response": "success"}


@todo_router.post("/request_change_facility_priority")
async def request_change_facility_priority(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Change the generation priority."""
    if not user.achievements["network"]:
        return ({"response": "notAuthorized"}), 404
    request_data = await request.json()
    priority = request_data["priority"]
    user.network_prices.change_facility_priority(new_priority=priority)
    return {"response": "success"}


@todo_router.post("/put_resource_on_sale")  # noqa: ANN201
async def put_resource_on_sale(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Put a resource on sale."""
    request_data = await request.json()
    resource = Fuel(request_data["resource"])
    quantity = float(request_data["resource"])
    price = float(request_data["resource"])
    try:
        energetica.utils.resource_market.put_resource_on_market(user, resource, quantity * 1000, price / 1000)
    except GameError as game_exception:
        if game_exception.exception_type != "notEnoughResource":
            raise
        # TODO: flash
        # flash_error(f"You have not enough {resource} available")
    else:
        # TODO: flash
        # flash(
        #     f"You put {quantity}t of {resource} on sale for "
        #     f"{price}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>/t",
        #     category="message",
        # )
        pass
    # return redirect("/resource_market", code=303)
    return RedirectResponse("/resource_market", status_code=status.HTTP_303_SEE_OTHER)


@todo_router.get("/buy_resource")
async def buy_resource(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Buy a resource from the market."""
    request_data = await request.json()
    id = int(request_data["id"])
    quantity = float(request_data["quantity"]) * 1000
    sale = ResourceOnSale.get(id)
    if sale is None:
        return JSONResponse({"response": "saleNotFound"}, status_code=status.HTTP_404_NOT_FOUND)
    energetica.utils.resource_market.buy_resource_from_market(user, quantity, sale)
    if user == sale.player:
        return {
            "response": "removedFromMarket",
            "quantity": quantity,
            "available_quantity": sale.quantity,
            "resource": sale.resource,
        }
    return {
        "response": "success",
        "resource": sale.resource,
        "total_price": sale.price * quantity,
        "quantity": quantity,
        "seller": sale.player.username,
        "available_quantity": sale.quantity,
        "shipments": user.package_shipments(),
    }


@todo_router.post("join_network")
async def join_network(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Join a network."""
    request_data = await request.json()
    choose_network = int(request_data["choose_network"])
    network = energetica.utils.network_helpers.join_network(user, Network.get(choose_network))
    # TODO: flash
    # flash(f"You joined the network {network.name}", category="message")
    engine.log(f"{user.username} joined the network {network.name}")
    return RedirectResponse("/network", status_code=status.HTTP_303_SEE_OTHER)


@todo_router.post("create_network")
async def create_network(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Create a network."""
    request_data = await request.json()
    network_name = str(request_data["network_name"])
    try:
        energetica.utils.network_helpers.create_network(user, network_name)
    except GameError as game_exception:
        # TODO: flash
        # match game_exception.exception_type:
        #     case "nameLengthInvalid":
        #         flash("Network name must be between 3 and 40 characters", category="error")
        #     case "nameAlreadyUsed":
        #         flash("A network with this name already exists", category="error")
        raise
    # flash(f"You created the network {network_name}", category="message")
    return RedirectResponse("/network", status_code=status.HTTP_303_SEE_OTHER)


@todo_router.post("leave_network")
def leave_network(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
):
    """Leave the current network."""
    network = user.network
    if network is None:
        return JSONResponse({"response": "notInNetwork"}, status_code=status.HTTP_404_NOT_FOUND)
    energetica.utils.network_helpers.leave_network(user)
    # TODO: flash
    # flash(f"You left network {network.name}", category="message")
    return RedirectResponse("/network", status_code=status.HTTP_303_SEE_OTHER)


@todo_router.get("hide_chat_disclaimer")
def hide_chat_disclaimer(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
):
    """Permanently hide the chat disclaimer."""
    energetica.utils.chat.hide_chat_disclaimer(user)
    return {"response": "success"}


@todo_router.post("create_chat")
async def create_chat(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Create a chat with one other player."""
    request_data = await request.json()
    buddy = Player.getitem(int(request_data["buddy_id"]))
    energetica.utils.chat.create_chat(user, None, {user, buddy})
    return {"response": "success"}


@todo_router.post("create_group_chat")
async def create_group_chat(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Create a group chat."""
    request_data = await request.json()
    chat_title = str(request_data["chat_title"])
    group_members = {user, *(map(Player.getitem, map(int, request_data["group_members"])))}
    energetica.utils.chat.create_chat(user, chat_title, group_members)
    return {"response": "success"}


@todo_router.post("change_graph_view")
async def change_graph_view(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Change the view mode for the graphs (basic, normal, expert)."""
    request_data = await request.json()
    view = Player.NetworkGraphView(request_data["view"])
    user.change_graph_view(view)
    return {"response": "success"}


@todo_router.get("/test_notification")
def test_notification(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Send a dummy browser notification to the player."""
    user.notify("Test notification", f"{engine.total_t} ({datetime.now()})")
    return {"response": "success"}


@todo_router.post("/set_notification_preferences")
async def set_notification_preferences(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request: Request,
):
    """Set notification preferences for a player."""
    request_data = await request.json()
    preferences = request_data["notification_preferences"]
    user.notification_preferences = preferences
    return {"response": "success"}
