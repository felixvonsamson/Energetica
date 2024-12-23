"""All requests for the websocket API."""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable

from energetica.database import db
from energetica.database.map import Hex

if TYPE_CHECKING:
    from energetica.database.player import Player
    from energetica.game_engine import GameEngine


def decorator_factory(response_type: str | None = None):
    def decorator(handler: Callable):
        """Decorate server messages by formatting the return value as a dictionary."""

        def wrapper(*args, **kwargs):
            from energetica.game_engine import GameError

            try:
                handler_return_value = handler(*args, **kwargs)
            except GameError as e:
                return {"error": {"type": e.exception_type}}

            if response_type is None:
                return {"success": {}}
            # if handler_return_value is dict:
            # value = handler_return_value:
            # elif handler_return_value is list:
            #     # {"_0": value_0, "_1": value_1, ...}
            #     value = {f"_{i}": item for i, item in enumerate(handler_return_value)}
            # else:
            value = {"_0": handler_return_value}
            # key = handler.__name__
            dictionary = {response_type: value}
            print(dictionary)
            return dictionary

        return wrapper

    return decorator


ws_request_handler = decorator_factory()
ws_request_handler_with_response_type = decorator_factory


@ws_request_handler
def confirm_location(engine: GameEngine, player: Player, location_id: int) -> None:
    """Confirm the player's location."""
    from energetica.utils import misc

    location = Hex.query.get(location_id)
    misc.confirm_location(engine, player, location)


@ws_request_handler
def dismiss_chat_disclaimer(engine: GameEngine, player: Player) -> None:
    """Dismiss the chat disclaimer."""
    player.show_disclaimer = False
    db.session.commit()


@ws_request_handler_with_response_type("new_chat")
def create_chat(engine: GameEngine, player: Player, buddy_id: int) -> None:
    """Create a chat message."""
    from energetica.database.player import Player
    from energetica.utils import chat

    buddy = Player.query.get(buddy_id)
    new_chat = chat.create_chat(player, buddy)
    return new_chat.id


@ws_request_handler_with_response_type("new_chat")
def create_group_chat(engine: GameEngine, player: Player, chat_name: str, participant_ids: list[int]) -> None:
    """Create a group chat."""
    from energetica.database.player import Player
    from energetica.utils import chat

    participants = [player, *list(Player.query.get(participant_id) for participant_id in participant_ids)]
    new_chat = chat.create_group_chat(player, chat_name, participants)
    return new_chat.id


@ws_request_handler
def send_message(engine: GameEngine, player: Player, chat_id: int, message: str) -> None:
    """Send a message to a chat."""
    from energetica.database.messages import Chat
    from energetica.utils.chat import add_message

    chat = db.session.get(Chat, chat_id)
    add_message(player, message, chat)


#  projects


@ws_request_handler
def queue_project(engine: GameEngine, player: Player, project_name: str) -> None:
    """Queue a project."""
    from energetica.utils import assets

    assets.queue_project(engine, player, project_name)
