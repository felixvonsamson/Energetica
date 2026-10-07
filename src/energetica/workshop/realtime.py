"""Workshop's Socket.IO server (#1140): how a change the facilitator makes reaches every open page.

Players and the facilitator both connect, through the same entry gate as Workshop's HTTP routes. The
server tracks nothing per connection, because everything it sends goes to every page. Mostly it sends
the frontend's ``invalidate`` message, which names cached queries for the page to re-read. While a
Trading period is being simulated, it also sends ``settlement_progress`` as the days go by (#1155), which
carries the progress itself so that pages do not re-read the whole session that often.

This is Workshop's own module rather than the persistent world's ``energetica.socketio``, which is
built around that world's players and game engine.
"""

from __future__ import annotations

from typing import Any

import socketio
from fastapi import FastAPI

from energetica.identity.web import admit_socket_connection
from energetica.workshop.schemas import WorkshopSettlementOut
from energetica.workshop.session import SettlementProgress

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


async def invalidate_session(app: FastAPI) -> None:
    """Tell every open page to re-read the session, and with it everything cached under its key."""
    await _emit(app, "invalidate", {"queries": [SESSION_QUERY_KEY]})


async def send_settlement_progress(app: FastAPI, progress: SettlementProgress) -> None:
    """Tell every open page how far the simulation of the Trading period has got, in the same shape as the
    session response's ``settlement``.
    """
    await _emit(app, "settlement_progress", WorkshopSettlementOut.from_progress(progress).model_dump())


async def _emit(app: FastAPI, event: str, data: dict[str, Any]) -> None:
    sio: socketio.AsyncServer | None = getattr(app.state, "socketio", None)
    # An app built only for its OpenAPI schema has no server.
    if sio is not None:
        await sio.emit(event, data)
