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

import asyncio
import math
from collections.abc import Awaitable, Callable
from typing import Any

import socketio
from fastapi import FastAPI

from energetica.identity.web import admit_socket_connection
from energetica.workshop.schemas import WorkshopSettlementOut
from energetica.workshop.session import SettlementProgress

# The frontend's query key for the session (``queryKeys.workshop.session``).
SESSION_QUERY_KEY = ["workshop", "session"]
# The frontend's query key for every Trading period's room prices (``queryKeys.workshop.marketPrices``).
MARKET_PRICES_QUERY_KEY = [*SESSION_QUERY_KEY, "market-prices"]
# The frontend's query key for the control room (``queryKeys.workshop.controlRoom``), which shows the room's prices too
# (#1289). It sits under the session's key, so every other change re-reads it with the session.
CONTROL_ROOM_QUERY_KEY = [*SESSION_QUERY_KEY, "control-room"]
#: The shortest time between two messages telling pages to re-read the room's prices. Each message makes every
#: open page read the prices again, so near the end of a price-setting window, when many players change prices at
#: once, sending one per change would grow with the square of the number of players (#1299).
MARKET_PRICES_INTERVAL_SECONDS = 0.5


def setup_socketio(app: FastAPI) -> None:
    """Mount a Socket.IO server at ``/socket.io`` and keep it on ``app.state`` for the routes."""
    sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*", logger=False)
    app.mount("/socket.io", socketio.ASGIApp(sio))
    app.state.socketio = sio
    app.state.market_prices_throttle = _Throttle(
        lambda: _emit(app, "invalidate", {"queries": [MARKET_PRICES_QUERY_KEY, CONTROL_ROOM_QUERY_KEY]})
    )

    @sio.event
    def connect(sid: str, environ: dict[str, Any], auth: Any) -> None:
        """Admit a player or the facilitator through the Workshop entry gate."""
        admit_socket_connection(environ)


async def invalidate_session(app: FastAPI) -> None:
    """Tell every open page to re-read the session, and with it everything cached under its key."""
    await _emit(app, "invalidate", {"queries": [SESSION_QUERY_KEY]})


async def invalidate_market_prices(app: FastAPI) -> None:
    """Tell every open page to re-read the room's prices, and the control room that shows them, because a player
    changed one (#1299, #1289). At most once
    every :data:`MARKET_PRICES_INTERVAL_SECONDS`: a change soon after the last message is sent once that time has
    passed, together with any other change made in between.
    """
    throttle: _Throttle | None = getattr(app.state, "market_prices_throttle", None)
    # An app built only for its OpenAPI schema has no server.
    if throttle is not None:
        await throttle()


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


class _Throttle:
    """Runs ``send`` at once when it last ran at least :data:`MARKET_PRICES_INTERVAL_SECONDS` ago, and otherwise
    once that time has passed. Calls made while a run is waiting do not add another.
    """

    def __init__(self, send: Callable[[], Awaitable[None]]) -> None:
        self._send = send
        self._last = -math.inf
        self._waiting: asyncio.Task[None] | None = None

    async def __call__(self) -> None:
        if self._waiting is not None:
            return
        wait = self._last + MARKET_PRICES_INTERVAL_SECONDS - asyncio.get_running_loop().time()
        if wait <= 0:
            await self._run()
        else:
            self._waiting = asyncio.create_task(self._run_after(wait))

    async def _run_after(self, wait: float) -> None:
        await asyncio.sleep(wait)
        self._waiting = None
        await self._run()

    async def _run(self) -> None:
        self._last = asyncio.get_running_loop().time()
        await self._send()
