"""These functions make the link between the website and the database."""

from typing import TYPE_CHECKING, Any

from flask import Blueprint, request
from flask.ctx import _AppCtxGlobals

from energetica.database.player import Player
from energetica.globals import engine

if TYPE_CHECKING:
    # The only purpose of this is to make the type checker happy. It tells the type checker that the `g` object
    # has an attribute `player` of type `Player`. It does nothing at runtime

    class _AppCtxGlobals(_AppCtxGlobals):  # type: ignore[no-redef]
        player: Player

    g: _AppCtxGlobals  # type: ignore[no-redef]


http = Blueprint("http", __name__)


# TODO: Address this function
@http.before_request
def restrict_access_during_simulation() -> Any:
    """Restrict access to the API during the simulation."""
    if (
        engine.serve_local
        and request.method == "POST"
        and request.headers.get("X-Forwarded-For", request.remote_addr) != "127.0.0.1"
    ):
        return "Service temporarily unavailable. Please try again in a few seconds", 503
