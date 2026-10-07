"""Workshop's Socket.IO server (#1140): how a change the facilitator makes reaches every open page.

Players and the facilitator both connect, through the same entry gate as Workshop's HTTP routes. The
server tracks nothing per connection, because everything it sends goes to every page. What it sends
is the frontend's ``invalidate`` message, which names cached queries for the page to re-read.

This is Workshop's own module rather than the persistent world's ``energetica.socketio``, which is
built around that world's players and game engine.
"""

from __future__ import annotations

from typing import Any

import socketio
from fastapi import FastAPI, Request

from energetica.identity.web import admit_socket_connection

# The frontend's query key for the session (``queryKeys.workshop.session``).
SESSION_QUERY_KEY = ["workshop", "session"]


def setup_socketio(app: FastAPI) -> None:
    """Mount a Socket.IO server at ``/socket.io`` and keep it on ``app.state`` for the routes."""
    sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*", logger=False)
    app.mount("/socket.io", socketio.ASGIApp(sio))
    app.state.socketio = sio

    @sio.event
    def connect(sid: str, environ: dict[str, Any], auth: Any) -> None:
        """Admit a player or the facilitator through the Workshop entry gate."""
        admit_socket_connection(environ)


async def invalidate_session(request: Request) -> None:
    """Tell every open page to re-read the session."""
    sio: socketio.AsyncServer | None = getattr(request.app.state, "socketio", None)
    # An app built only for its OpenAPI schema has no server.
    if sio is not None:
        await sio.emit("invalidate", {"queries": [SESSION_QUERY_KEY]})
