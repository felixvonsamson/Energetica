"""The ``log_action`` middleware writes a request's line to the action log while still holding the
engine lock (#1317).

If the line were written after the lock is released, the tick thread could run a tick and write its
``tick`` line in between, so the log would show the request after a tick it ran before. Replay would
then apply the request in the wrong place, and a save taken in that tick would apply it twice.

The test replaces ``engine.log_action`` with a recorder that asks, from another thread, whether the
lock is free at the moment the line is written. Another thread, because the engine lock is
re-entrant: the thread that holds it could always take it again.
"""

from __future__ import annotations

import threading

import pytest
from fastapi.testclient import TestClient

from energetica.freeplay.app import create_app
from energetica.freeplay.globals import engine
from energetica.freeplay.schemas.simulate import Action

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
    """A facilitator's writes change instance.json and the lobby, not the world, so replay must not
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
