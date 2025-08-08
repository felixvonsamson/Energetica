"""
Socket.IO setup for Energetica.

Mounts a Socket.IO server to the FastAPI app and authenticates connections via a session cookie.
"""

from http.cookies import SimpleCookie
from typing import Any, cast

import socketio
from fastapi import FastAPI
from socketio.exceptions import ConnectionRefusedError

from energetica.utils.auth import get_current_user_from_token
from energetica.database.player import Player
from energetica.globals import engine


def setup_socketio(app: FastAPI) -> None:
    """Attach Socket.IO to the FastAPI app and handle user connections."""
    sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*", logger=False)
    engine.socketio = sio
    app.mount("/socket.io", socketio.ASGIApp(engine.socketio))

    connected_users_by_sid: dict[str, Player] = {}

    @sio.event
    def connect(sid: str, environ: dict[str, Any], auth: Any) -> None:
        """Authenticate a connecting client via session cookie."""
        cookie_header = environ.get("HTTP_COOKIE")
        if cookie_header is None:
            raise ConnectionRefusedError("authentication failed")
        cookie = SimpleCookie()
        cookie.load(cast(str, cookie_header))
        session_token = cookie.get("session")
        if session_token is None:
            raise ConnectionRefusedError("authentication failed")
        user = get_current_user_from_token(cast(str, session_token.value))
        if user is None:
            raise ConnectionRefusedError("authentication failed")
        user.socketio_clients.append(sid)
        connected_users_by_sid[sid] = user

    @sio.event
    def disconnect(sid: str) -> None:
        """Clean up user on disconnect."""
        user = connected_users_by_sid.pop(sid, None)
        if user:
            user.socketio_clients.remove(sid)
