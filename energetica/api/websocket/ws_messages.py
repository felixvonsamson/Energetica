"""Server messages for the websocket server."""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable

from energetica.database.map import Hex

if TYPE_CHECKING:
    from energetica.database.player import Player


def server_message(func: Callable):
    """Decorate server messages by formatting the return value as a dictionary."""

    def wrapper(*args, **kwargs):
        key = func.__name__
        function_return = func(*args, **kwargs)
        if function_return is dict:
            value = function_return
        elif function_return is list:
            # {"_0": value_0, "_1": value_1, ...}
            value = {f"_{i}": item for i, item in enumerate(function_return)}
        else:
            value = {"_0": function_return}
        return {key: value}

    return wrapper


@server_message
def players() -> dict[int, dict]:
    """Package data for all players."""
    from energetica.database.player import Player

    return Player.package_all()


@server_message
def user_player_id(player: Player) -> int:
    """Package the ID of the user's player."""
    return player.id


@server_message
def get_map() -> dict:
    """Package the map data from the database and returns it as a JSON string as a dictionary of arrays."""
    hex_list = Hex.query.order_by(Hex.r, Hex.q).all()
    return {
        "ids": [tile.id for tile in hex_list],
        "solars": [tile.solar for tile in hex_list],
        "winds": [tile.wind for tile in hex_list],
        "hydros": [tile.hydro for tile in hex_list],
        "coals": [tile.coal for tile in hex_list],
        "gases": [tile.gas for tile in hex_list],
        "uraniums": [tile.uranium for tile in hex_list],
        "climate_risks": [tile.climate_risk for tile in hex_list],
    }


@server_message
def facilities_data(player: Player) -> dict[str, list]:
    """Package the player's facilities data and returns it as a JSON string."""
    return player.cache.all_facilities_data
