"""All requests for the websocket API."""

from typing import Callable

from energetica.database.map import Hex
from energetica.database.player import Player
from energetica.game_engine import GameEngine
from energetica.utils import misc


def ws_request_handler(func: Callable) -> Callable[..., dict]:
    """Decorate server messages by formatting the return value as a dictionary."""

    def wrapper(*args, **kwargs) -> dict:
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
    location = Hex.query.get(location_id)
    misc.confirm_location(engine, player, location)
