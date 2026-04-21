"""
Socket.IO setup for Energetica.

Mounts a Socket.IO server to the FastAPI app and authenticates connections via a session cookie.
"""

from http.cookies import SimpleCookie
from typing import Any, cast

import socketio
from fastapi import FastAPI
from socketio.exceptions import ConnectionRefusedError

from energetica.database.player import Player
from energetica.database.user import User
from energetica.globals import engine
from energetica.utils.auth import get_user_from_token


def setup_socketio(app: FastAPI) -> None:
    """Attach Socket.IO to the FastAPI app and handle user connections."""
    sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*", logger=False)
    engine.socketio = sio
    app.mount("/socket.io", socketio.ASGIApp(engine.socketio))

    connected_players_by_sid: dict[str, Player | None] = {}
    connected_admins_by_sid: dict[str, User] = {}

    @sio.event
    def connect(sid: str, environ: dict[str, Any], auth: Any) -> None:
        """Authenticate a connecting client via session cookie."""
        cookie_header = environ.get("HTTP_COOKIE")
        if cookie_header is None:
            raise ConnectionRefusedError("authentication failed: no cookies")
        cookie = SimpleCookie()
        cookie.load(cast(str, cookie_header))
        session_token = cookie.get("session")
        if session_token is None:
            raise ConnectionRefusedError("authentication failed: no session token")
        user = get_user_from_token(cast(str, session_token.value))
        if user is None:
            raise ConnectionRefusedError("authentication failed: invalid token")

        if user.is_admin:
            connected_admins_by_sid[sid] = user
            return

        if user.role != "player":
            raise ConnectionRefusedError("authentication failed: unknown role")

        # Allow unsettled players to connect so they can receive broadcasts (e.g., map updates)
        # Only track socketio_clients if player exists (for targeted player.emit())
        if user.player is not None:
            user.player.socketio_clients.append(sid)
            connected_players_by_sid[sid] = user.player
        else:
            # Track unsettled users with None so we can clean up on disconnect
            connected_players_by_sid[sid] = None

    @sio.event
    def disconnect(sid: str) -> None:
        """Clean up user on disconnect."""
        if sid in connected_admins_by_sid:
            del connected_admins_by_sid[sid]
            return
        player = connected_players_by_sid.pop(sid, None)
        if player is not None:
            player.socketio_clients.remove(sid)
