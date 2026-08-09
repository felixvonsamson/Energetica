"""Contract test: the game app and the lobby app must serialise errors identically.

Two exception handlers produce every non-``HTTPException`` error the frontend sees — one for
``GameError`` (400) and one for ``RequestValidationError`` (422) — and each is written out twice,
in ``energetica/routers/__init__.py`` and in ``lobby/app.py``. The duplication is deliberate: the
lobby is engine-free and imports nothing from the game's router package (ADR-0002). Nothing else
asserts the two copies agree, and the generated-types freshness check structurally cannot see
them, because both envelopes are hand-built ``JSONResponse`` bodies rather than declared response
models, so neither reaches the OpenAPI schema.

Each app is driven through two probe routes registered here, one per envelope shape. Probes rather
than real endpoints because the game side raises ``GameError`` only from deep in the engine, behind
a settled player — the handler, not the route that trips it, is what this test is about.
"""

from __future__ import annotations

from collections.abc import Callable

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from energetica import create_app
from energetica.game_error import GameError, GameExceptionType
from energetica.globals import engine
from lobby import create_lobby_app

GAME_ERROR_PATH = "/probe/game-error"
VALIDATION_PATH = "/probe/validation-error"


class _ProbeBody(BaseModel):
    count: int


def _add_probe_routes(app: FastAPI) -> None:
    """Attach one route per envelope shape: a ``GameError`` raiser and a schema that will not
    validate.
    """

    @app.get(GAME_ERROR_PATH)
    def _raise_game_error() -> None:
        raise GameError(GameExceptionType.NOT_ENOUGH_MONEY, required=10)

    @app.post(VALIDATION_PATH)
    def _validate(body: _ProbeBody) -> None:
        return None


def _game_client() -> TestClient:
    # schema_only builds the routed app without the engine, tick loop or instance directory; the
    # exception handlers and the log_action middleware are registered before that early return.
    app = create_app(env="dev", schema_only=True)
    # serve_local defaults True, which makes log_action reject every non-GET as a 503.
    engine.serve_local = False
    _add_probe_routes(app)
    return TestClient(app)


def _lobby_client() -> TestClient:
    app = create_lobby_app()
    _add_probe_routes(app)
    return TestClient(app)


CLIENT_FACTORIES: dict[str, Callable[[], TestClient]] = {"game": _game_client, "lobby": _lobby_client}
both_apps = pytest.mark.parametrize("make_client", CLIENT_FACTORIES.values(), ids=CLIENT_FACTORIES.keys())


@both_apps
def test_game_error_envelope(make_client: Callable[[], TestClient]) -> None:
    """A ``GameError`` is always a 400 carrying the code and its kwargs, and nothing else."""
    response = make_client().get(GAME_ERROR_PATH)

    assert response.status_code == 400
    assert response.json() == {"game_exception_type": GameExceptionType.NOT_ENOUGH_MONEY, "kwargs": {"required": 10}}


@both_apps
def test_validation_error_envelope(make_client: Callable[[], TestClient]) -> None:
    """A schema failure is always a 422 carrying pydantic's own error list plus the ``meta`` tag
    that tells the frontend which envelope it is holding.
    """
    response = make_client().post(VALIDATION_PATH, json={"count": "not-a-number"})

    assert response.status_code == 422
    body = response.json()
    assert set(body) == {"detail", "meta"}
    assert body["meta"] == {"error_type": "request_validation_error"}
    assert [error["loc"] for error in body["detail"]] == [["body", "count"]]


@pytest.mark.parametrize("path, method, payload", [(GAME_ERROR_PATH, "GET", None), (VALIDATION_PATH, "POST", {})])
def test_both_apps_serialise_the_same_error_identically(path: str, method: str, payload: dict | None) -> None:
    """The contract itself: byte-for-byte the same status and body from both apps.

    The shape assertions above would still pass if both copies of a handler drifted together; this
    one fails the moment only one of them is edited.
    """
    responses = [factory().request(method, path, json=payload) for factory in CLIENT_FACTORIES.values()]
    game, lobby = responses

    assert game.status_code == lobby.status_code
    assert game.json() == lobby.json()
