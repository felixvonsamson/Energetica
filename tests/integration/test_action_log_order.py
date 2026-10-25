"""The ``log_action`` middleware writes a request's line to the action log while still holding the
engine lock (#1317).

If the line were written after the lock is released, the tick thread could run a tick and write its
``tick`` line in between, so the log would show the request after a tick it ran before. Replay would
then apply the request in the wrong place, and a save taken in that tick would apply it twice.

The test replaces ``engine.log_action`` with a recorder that asks, from another thread, whether the
lock is free at the moment the line is written. Another thread, because the engine lock is
re-entrant: the thread that holds it could always take it again.

The middleware also decides whose requests are logged at all: only players', resolved before the
route runs (#1283).
"""

from __future__ import annotations

import threading
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from energetica.freeplay.app import create_app
from energetica.freeplay.globals import engine
from energetica.freeplay.schemas.simulate import Action
from energetica.identity import web
from energetica.identity.lobby_service_client import LobbyServiceClient
from energetica.kernel.game_error import SharedErrorCode

from ._session_helpers import authenticate, grant_facilitator, make_account

PROBE_PATH = "/probe/mutate"


def _lock_is_free() -> bool:
    """Whether a thread other than the caller could take the engine lock right now."""
    result: list[bool] = []

    def try_lock() -> None:
        acquired = engine.lock.acquire(blocking=False)
        if acquired:
            engine.lock.release()
        result.append(acquired)

    thread = threading.Thread(target=try_lock)
    thread.start()
    thread.join()
    return result[0]


def test_request_is_logged_while_holding_the_engine_lock(monkeypatch: pytest.MonkeyPatch) -> None:
    app = create_app(env="dev", schema_only=True)
    # serve_local defaults True, which makes log_action reject every non-GET as a 503. The autouse
    # conftest fixture puts it back after the test.
    engine.serve_local = False

    @app.post(PROBE_PATH)
    def _mutate() -> dict[str, bool]:
        return {"ok": True}

    lock_free_when_logged: list[bool] = []

    def record_lock_state(action: Action) -> None:
        lock_free_when_logged.append(_lock_is_free())

    monkeypatch.setattr(engine, "log_action", record_lock_state)

    client = TestClient(app)
    authenticate(client, make_account())
    response = client.post(PROBE_PATH, json={})

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert lock_free_when_logged == [False]


def test_only_a_players_requests_are_logged(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    A facilitator's writes change instance.json and the lobby, not the world, so replay must not
    redo them, and replay acts as a player. The action log therefore leaves them out.
    """
    app = create_app(env="dev", schema_only=True)
    engine.serve_local = False

    @app.post(PROBE_PATH)
    def _mutate() -> dict[str, bool]:
        return {"ok": True}

    logged: list[int] = []
    monkeypatch.setattr(engine, "log_action", lambda action: logged.append(action.user_id))
    player, facilitator = TestClient(app), TestClient(app)
    player_id = make_account("player")
    authenticate(player, player_id)
    facilitator_id = make_account("facilitator")
    grant_facilitator(facilitator_id)
    authenticate(facilitator, facilitator_id)

    assert player.post(PROBE_PATH, json={}).status_code == 200
    assert facilitator.post(PROBE_PATH, json={}).status_code == 200

    assert logged == [player_id]


def test_a_write_is_refused_before_it_runs_when_the_lobby_service_is_down(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    The action log needs the caller's account, so it resolves the session before the route runs. A
    lobby service it cannot reach is a 503 with nothing changed, not a 500 after the change.
    """
    app = create_app(env="dev", schema_only=True)
    engine.serve_local = False
    ran: list[bool] = []

    @app.post(PROBE_PATH)
    def _mutate() -> dict[str, bool]:
        ran.append(True)
        return {"ok": True}

    client = TestClient(app)
    authenticate(client, make_account())
    unreachable = LobbyServiceClient.connect("test", socket_path=Path("/tmp/absent.sock"))
    monkeypatch.setattr(web, "_lobby_service", unreachable)

    response = client.post(PROBE_PATH, json={})

    assert response.status_code == 503
    assert response.json()["detail"] == SharedErrorCode.LOBBY_SERVICE_UNAVAILABLE
    assert ran == []
