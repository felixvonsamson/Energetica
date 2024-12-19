"""All requests for the websocket API."""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable

from energetica.database.map import Hex

if TYPE_CHECKING:
    from energetica.database.player import Player
    from energetica.game_engine import GameEngine


def ws_request_handler(func: Callable):
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
        dictionary = {key: value}
        print(dictionary)
        return dictionary

    return wrapper


@ws_request_handler
def confirm_location(engine: GameEngine, player: Player, location_id: int) -> None:
    """Confirm the player's location."""
    from energetica.utils import misc

    location = Hex.query.get(location_id)
    misc.confirm_location(engine, player, location)
