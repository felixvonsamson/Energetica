"""Legacy HTTP API routes."""
# TODO(mglst): migrate to `energetica/routers/<xyz>.py`

import pickle
from datetime import datetime
from pathlib import Path
from typing import Annotated

import numpy as np
from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse

from energetica.config.assets import wind_power_curve
from energetica.database.network import Network
from energetica.database.player import Player
from energetica.game_error import GameError, GameExceptionType
from energetica.globals import engine
from energetica.utils.auth import get_current_user

# TODO: migrate all these routes to native FastAPI routes
todo_router = APIRouter(prefix="", tags=["Flask Migration"])


@todo_router.get("/get_const_config")
def get_const_config():  # noqa: ANN201
    """Get constant config data."""
    return engine.const_config


@todo_router.get("/get_wind_power_curve")
def get_wind_power_curve():  # noqa: ANN201
    """Get the wind power curve."""
    return wind_power_curve


@todo_router.get("/get_networks")
def get_networks():  # noqa: ANN201
    """Get all the network names and returns it as a list."""
    networks = {network.id: network.name for network in Network.all()}
    return networks


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
        return JSONResponse("", status_code=status.HTTP_404_NOT_FOUND)
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

    return {
        "total_t": total_t,
        "data": data,
        "network_data": network_data,
        "climate_data": climate_data,
        "cumulative_emissions": user.cumul_emissions.get_all(),
    }


@todo_router.get("/get_network_capacities")
def get_network_capacities(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get the network capacities for the current player."""
    if user.network is None:
        return JSONResponse("", status_code=status.HTTP_404_NOT_FOUND)
    return user.network.capacities.get_all()


@todo_router.get("/get_market_data")
def get_market_data(user: Annotated[Player, Depends(get_current_user)], t: int):  # noqa: ANN201
    """Get the data for the market graph at a specific tick."""
    market_data = {}
    if user.network is None:
        return JSONResponse("", status_code=status.HTTP_404_NOT_FOUND)
    filename_state = f"instance/data/networks/{user.network.id}/charts/market_t{engine.total_t - t}.pck"
    if Path(filename_state).is_file():
        with open(filename_state, "rb") as file:
            market_data = pickle.load(file)
            market_data["capacities"] = market_data["capacities"].to_dict(orient="list")
            market_data["demands"] = market_data["demands"].to_dict(orient="list")
    else:
        return JSONResponse("", status_code=status.HTTP_404_NOT_FOUND)
    return market_data


@todo_router.get("/get_player_data")
def get_player_data(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get count of assets and config for this player."""
    if user.tile is None:
        return JSONResponse("", status_code=status.HTTP_404_NOT_FOUND)
    levels = user.get_lvls()
    capacities = user.capacities.get_all()
    return {
        "levels": levels,
        "config": user.config,
        "capacities": capacities,
    }


@todo_router.get("/get_resource_reserves")
def get_resource_reserves(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get the natural resources reserves for this player."""
    if user.tile is None:
        raise GameError(GameExceptionType.NO_TILE)
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


@todo_router.get("/get_active_facilities")
def get_active_facilities(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get the active facilities for this player."""
    return user.package_active_facilities()


@todo_router.post("/change_graph_view")
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
