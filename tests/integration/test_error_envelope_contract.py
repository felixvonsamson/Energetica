"""Contract test: every app serialises errors identically, and returns only its own error codes.

Two exception handlers produce every non-``HTTPException`` error the frontend sees — one for
``GameError`` (400, or the status its class sets) and one for ``RequestValidationError`` (422). Each app installs them with
``install_error_handlers``. The generated-types freshness check structurally cannot see them,
because both envelopes are hand-built ``JSONResponse`` bodies rather than declared response models,
so neither reaches the OpenAPI schema.

Each app is driven through probe routes registered here, one per envelope shape plus one raising a
code of the app's own. Probes rather than real endpoints because the game side raises ``GameError``
only from deep in the engine, behind a settled player — the handler, not the route that trips it,
is what this test is about.

The error codes are split by layer and app: the kernel holds the codes every app can return, the
identity layer the codes of the join and facilitator routes both Instance apps mount, and each app
its own. Each app's OpenAPI schema lists exactly the codes it can return, so its frontend can only
handle those.
"""

from __future__ import annotations

import importlib.util
from collections.abc import Callable
from pathlib import Path
from types import ModuleType

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from energetica.freeplay.app import create_app
from energetica.freeplay.game_error import FreeplayErrorCode
from energetica.freeplay.globals import engine
from energetica.identity.game_error import IdentityErrorCode
from energetica.kernel.game_error import ErrorCode, GameError, SharedErrorCode
from energetica.workshop.app import create_workshop_app
from energetica.workshop.game_error import WorkshopErrorCode
from lobby import create_lobby_app
from lobby.game_error import LobbyErrorCode

_GENERATOR = Path(__file__).resolve().parents[2] / "scripts" / "generate_openapi_schema.py"

GAME_ERROR_PATH = "/probe/game-error"
OWN_CODE_PATH = "/probe/own-code"
NOT_FOUND_PATH = "/probe/not-found"
VALIDATION_PATH = "/probe/validation-error"

# The codes each app can return, pinned here so that moving a code between enums, or giving an app
# another enum's codes, is a deliberate change.
APP_CODES: dict[str, tuple[type[ErrorCode], ...]] = {
    "freeplay": (SharedErrorCode, IdentityErrorCode, FreeplayErrorCode),
    "workshop": (SharedErrorCode, IdentityErrorCode, WorkshopErrorCode),
    "lobby": (SharedErrorCode, LobbyErrorCode),
}

# One code of each app's own, with the value players receive for it.
OWN_CODES: dict[str, tuple[ErrorCode, str]] = {
    "freeplay": (FreeplayErrorCode.NOT_ENOUGH_MONEY, "Not enough money"),
    "workshop": (WorkshopErrorCode.WORKSHOP_NOT_ENOUGH_MONEY, "WORKSHOP_NOT_ENOUGH_MONEY"),
    "lobby": (LobbyErrorCode.SIGNUP_DISABLED, "SIGNUP_DISABLED"),
}


class _ProbeBody(BaseModel):
    count: int


class _NotFoundError(GameError):
    status_code = 404


def _add_probe_routes(app: FastAPI, own_code: ErrorCode) -> None:
    """Attach one route per envelope shape, a ``GameError`` raiser and a schema that will not
    validate, and a route raising ``own_code``.
    """

    @app.get(GAME_ERROR_PATH)
    def _raise_game_error() -> None:
        raise GameError(SharedErrorCode.INSTANCE_ACCESS_DENIED, slug="probe-run")

    @app.get(OWN_CODE_PATH)
    def _raise_own_code() -> None:
        raise GameError(own_code)

    @app.get(NOT_FOUND_PATH)
    def _raise_not_found() -> None:
        raise _NotFoundError(SharedErrorCode.USER_NOT_FOUND)

    @app.post(VALIDATION_PATH)
    def _validate(body: _ProbeBody) -> None:
        return None


def _freeplay_client() -> TestClient:
    # schema_only builds the routed app without the engine, tick loop or instance directory; the
    # exception handlers and the log_action middleware are registered before that early return.
    app = create_app(env="dev", schema_only=True)
    # serve_local defaults True, which makes log_action reject every non-GET as a 503. The autouse
    # conftest fixture puts it back after the test.
    engine.serve_local = False
    _add_probe_routes(app, OWN_CODES["freeplay"][0])
    return TestClient(app)


def _workshop_client() -> TestClient:
    app = create_workshop_app(schema_only=True)
    _add_probe_routes(app, OWN_CODES["workshop"][0])
    return TestClient(app)


def _lobby_client() -> TestClient:
    app = create_lobby_app()
    _add_probe_routes(app, OWN_CODES["lobby"][0])
    return TestClient(app)


CLIENT_FACTORIES: dict[str, Callable[[], TestClient]] = {
    "freeplay": _freeplay_client,
    "workshop": _workshop_client,
    "lobby": _lobby_client,
}
every_app = pytest.mark.parametrize("app_name", CLIENT_FACTORIES)


@every_app
def test_game_error_envelope(app_name: str) -> None:
    """A ``GameError`` is a 400 carrying the code and its kwargs, and nothing else."""
    response = CLIENT_FACTORIES[app_name]().get(GAME_ERROR_PATH)

    assert response.status_code == 400
    assert response.json() == {"game_exception_type": "INSTANCE_ACCESS_DENIED", "kwargs": {"slug": "probe-run"}}


@every_app
def test_a_game_error_class_can_set_its_status(app_name: str) -> None:
    """A ``GameError`` subclass can answer with another status, such as 404, in the same envelope."""
    response = CLIENT_FACTORIES[app_name]().get(NOT_FOUND_PATH)

    assert response.status_code == 404
    assert response.json() == {"game_exception_type": "USER_NOT_FOUND", "kwargs": {}}


@every_app
def test_an_apps_own_code_is_sent_as_its_value(app_name: str) -> None:
    """An app's own code reaches players as the same string as before the codes were split."""
    _, value = OWN_CODES[app_name]
    response = CLIENT_FACTORIES[app_name]().get(OWN_CODE_PATH)

    assert response.status_code == 400
    assert response.json() == {"game_exception_type": value, "kwargs": {}}


@every_app
def test_validation_error_envelope(app_name: str) -> None:
    """A schema failure is always a 422 carrying pydantic's own error list plus the ``meta`` tag
    that tells the frontend which envelope it is holding.
    """
    response = CLIENT_FACTORIES[app_name]().post(VALIDATION_PATH, json={"count": "not-a-number"})

    assert response.status_code == 422
    body = response.json()
    assert set(body) == {"detail", "meta"}
    assert body["meta"] == {"error_type": "request_validation_error"}
    assert [error["loc"] for error in body["detail"]] == [["body", "count"]]


@pytest.mark.parametrize("path, method, payload", [(GAME_ERROR_PATH, "GET", None), (VALIDATION_PATH, "POST", {})])
def test_every_app_serialises_the_same_error_identically(path: str, method: str, payload: dict | None) -> None:
    """The contract itself: byte-for-byte the same status and body from every app.

    The shape assertions above would still pass if every app's handler drifted together; this one
    fails the moment one app answers differently.
    """
    first, *rest = (factory().request(method, path, json=payload) for factory in CLIENT_FACTORIES.values())

    for response in rest:
        assert response.status_code == first.status_code
        assert response.json() == first.json()


@pytest.fixture(scope="module")
def schemas() -> dict[str, dict]:
    """Each app's OpenAPI schema and the merged one, as `bun run generate-types` writes them."""
    spec = importlib.util.spec_from_file_location("generate_openapi_schema", _GENERATOR)
    assert spec is not None and spec.loader is not None
    generator: ModuleType = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(generator)
    return generator.build_schemas()


def _schema_codes(schema: dict) -> set[str]:
    return set(schema["components"]["schemas"]["ErrorCode"]["enum"])


@pytest.mark.parametrize("app_name", APP_CODES)
def test_each_app_schema_has_the_shared_codes_plus_its_own(schemas: dict[str, dict], app_name: str) -> None:
    assert _schema_codes(schemas[app_name]) == {code.value for enum in APP_CODES[app_name] for code in enum}


@pytest.mark.parametrize("app_name", ["freeplay", "lobby"])
def test_no_workshop_code_outside_the_workshop(schemas: dict[str, dict], app_name: str) -> None:
    """Workshop's codes reach neither the kernel nor another app's schema.

    Checked both by value and by the ``WORKSHOP_`` prefix, so a Workshop code added to the wrong
    enum fails too.
    """
    workshop_codes = {code.value for code in WorkshopErrorCode}
    for codes in ({code.value for code in SharedErrorCode}, _schema_codes(schemas[app_name])):
        assert not codes & workshop_codes
        assert not {code for code in codes if code.startswith("WORKSHOP_")}


def test_merged_schema_keeps_every_code(schemas: dict[str, dict]) -> None:
    """Until the merged schema is deleted (#1183), the bundles that still use it see every code."""
    assert _schema_codes(schemas["merged"]) == set().union(*(_schema_codes(schemas[app]) for app in APP_CODES))


def test_no_two_codes_share_a_value() -> None:
    """Players receive a code's value, so two codes with one value could not be told apart."""
    enums = {enum for enums in APP_CODES.values() for enum in enums}
    values = [code.value for enum in enums for code in enum]
    assert len(values) == len(set(values))
