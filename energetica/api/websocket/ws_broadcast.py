"""Broadcast messages to all active WebSocket connections."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from flask import current_app
from simple_websocket import ConnectionClosed, Server

from energetica.api.websocket import ws_messages

if TYPE_CHECKING:
    from energetica.game_engine import GameEngine


def websocket_broadcast(func):
    """Decorate broadcast messages by sending them to all active WebSocket connections."""

    def wrapper(*args, **kwargs):
        engine: GameEngine = current_app.config["engine"]
        message_str = json.dumps(func(*args, **kwargs))
        for player_id, wss in engine.websocket_dict.items():
            for ws in wss:
                try:
                    ws.send(message_str)
                except ConnectionClosed:
                    unregister_websocket_connection(engine, player_id, ws)

    return wrapper


def register_websocket_connection(engine: GameEngine, player_id: int, ws: Server) -> None:
    """Add the websocket object to the player's registered connections."""
    # engine.log(f"Websocket connection opened for player {player_id}")
    engine.websocket_dict[player_id].append(ws)


def unregister_websocket_connection(engine: GameEngine, player_id: int, ws: Server) -> None:
    """Remove the websocket object from the player's registered connections."""
    # engine.log(f"Websocket connection closed for player {player_id}")
    engine.websocket_dict[player_id].remove(ws)


@websocket_broadcast
def players() -> list:
    """Package data for all players."""
    return ws_messages.players()
