"""
Socket.IO setup for Energetica.

Mounts a Socket.IO server to the FastAPI app and admits connections through the instance's entry gate.
"""

from typing import Any

import socketio
from fastapi import FastAPI
from socketio.exceptions import ConnectionRefusedError

from energetica.freeplay.database.player import Player
from energetica.freeplay.globals import engine
from energetica.identity.web import admit_socket_connection, get_role


def setup_socketio(app: FastAPI) -> None:
    """Attach Socket.IO to the FastAPI app and handle user connections."""
    sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*", logger=False)
    engine.socketio = sio
    app.mount("/socket.io", socketio.ASGIApp(engine.socketio))

    connected_users_by_sid: dict[str, Player | None] = {}

    @sio.event
    def connect(sid: str, environ: dict[str, Any], auth: Any) -> None:
        """Admit a connecting player through the same entry gate as the HTTP routes."""
        account = admit_socket_connection(environ)
        if get_role(account.account_id) != "player":
            raise ConnectionRefusedError("authentication failed: not a player")

        # Allow unsettled players to connect so they can receive broadcasts (e.g., map updates)
        # Only track socketio_clients if player exists (for targeted player.emit())
        player = next(Player.filter_by(account_id=account.account_id), None)
        if player is not None:
            player.socketio_clients.append(sid)
            connected_users_by_sid[sid] = player
        else:
            # Track unsettled accounts with None so we can clean up on disconnect
            connected_users_by_sid[sid] = None

    @sio.event
    def disconnect(sid: str) -> None:
        """Clean up user on disconnect."""
        player = connected_users_by_sid.pop(sid, None)
        if player is not None:
            player.socketio_clients.remove(sid)
