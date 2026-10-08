"""Shared pytest fixtures.

The autouse `_isolated_accounts_db` fixture redirects the server-wide accounts SQLite store to a
per-test temp file. Without it, any test that calls ``create_app`` (or otherwise touches
``energetica.identity.accounts``) would write to the dev default ``instance/accounts.db`` in the
repo, leaking state across tests and into the developer's working tree.

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

from energetica.freeplay.globals import engine
from energetica.identity.accounts.db import _reset_initialised_paths


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


@pytest.fixture(autouse=True)
def _isolated_accounts_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    db_path = tmp_path / "accounts.db"
    monkeypatch.setenv("ENERGETICA_ACCOUNTS_DB_PATH", str(db_path))
    yield db_path
    # Drop the per-path schema-bootstrap cache so a later test reusing a path can't hit a
    # silent "no such table" from skipped schema creation.
    _reset_initialised_paths()
