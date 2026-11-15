"""Shared pytest fixtures.

The `lobby_service` fixture gives each test that needs accounts a real lobby service over a
per-test ``lobby.db``, so no test touches the dev database.

The autouse `_restore_serve_local` fixture puts ``engine.serve_local`` back after every test. The
engine is a module-scope singleton, so a test that flips the flag changes it for every test that
runs after it — and the flag is load-bearing in two places: ``log_action`` turns every non-GET into
a 503 while it is True, and ``/healthz`` reports ``resimulating``. Tests set it explicitly for what
they need; this makes that setting local instead of permanent.

The autouse `_cheap_password_hashing` fixture hashes passwords at bcrypt's lowest cost. At the
production cost each hash takes about half a second, and most integration tests create several
accounts, so it used to take half the suite's run time. Hashing and checking still run the real
bcrypt code; only the cost factor stored in the hash changes.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import bcrypt
import pytest
from fastapi.testclient import TestClient

from energetica.freeplay.globals import engine
from energetica.identity import web
from energetica.identity.lobby_service_client import BASE_URL, LobbyServiceClient
from lobby_service.app import create_service_app
from lobby_service.schema import upgrade_database


@pytest.fixture(autouse=True)
def _restore_serve_local() -> Iterator[None]:
    """Undo any test's change to the process-wide ``engine.serve_local`` flag."""
    previous = engine.serve_local
    yield
    engine.serve_local = previous


# bcrypt's lowest allowed cost factor. Production uses the library default of 12, which is 256 times
# the work.
_TEST_BCRYPT_ROUNDS = 4


@pytest.fixture(autouse=True)
def _cheap_password_hashing(monkeypatch: pytest.MonkeyPatch) -> None:
    """Make every password hash in the test use bcrypt's lowest cost."""
    real_gensalt = bcrypt.gensalt

    def cheap_gensalt(rounds: int = _TEST_BCRYPT_ROUNDS, prefix: bytes = b"2b") -> bytes:
        return real_gensalt(min(rounds, _TEST_BCRYPT_ROUNDS), prefix)

    monkeypatch.setattr(bcrypt, "gensalt", cheap_gensalt)


@pytest.fixture
def lobby_service(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> LobbyServiceClient:
    """
    A client for a real lobby service app, called in-process, over a fresh ``lobby.db``.

    Runs use it too: it replaces the client in :mod:`energetica.identity.web` for the test.
    """
    db_path = tmp_path / "lobby.db"
    monkeypatch.setenv("ENERGETICA_LOBBY_DB_PATH", str(db_path))
    upgrade_database(db_path)
    client = LobbyServiceClient(TestClient(create_service_app(), base_url=BASE_URL))
    monkeypatch.setattr(web, "_lobby_service", client)
    return client


@pytest.fixture
def no_demand_growth(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep Workshop demand flat from Round to Round (#1226).

    For session tests that play several Rounds with a small fleet and are not about demand: grown demand would
    black them out.
    """
    monkeypatch.setattr("energetica.workshop.session.growth_factor", lambda average_profit: 1.0)
