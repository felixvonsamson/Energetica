"""Shared pytest fixtures.

The autouse `_isolated_accounts_db` fixture redirects the server-wide accounts SQLite store to a
per-test temp file. Without it, any test that calls ``create_app`` (or otherwise touches
``energetica.accounts``) would write to the dev default ``instance/accounts.db`` in the repo,
leaking state across tests and into the developer's working tree.

The autouse `_restore_serve_local` fixture puts ``engine.serve_local`` back after every test. The
engine is a module-scope singleton, so a test that flips the flag changes it for every test that
runs after it — and the flag is load-bearing in two places: ``log_action`` turns every non-GET into
a 503 while it is True, and ``/healthz`` reports ``resimulating``. Tests set it explicitly for what
they need; this makes that setting local instead of permanent.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest

from energetica.accounts.db import _reset_initialised_paths
from energetica.globals import engine


@pytest.fixture(autouse=True)
def _restore_serve_local() -> Iterator[None]:
    """Undo any test's change to the process-wide ``engine.serve_local`` flag."""
    previous = engine.serve_local
    yield
    engine.serve_local = previous


@pytest.fixture(autouse=True)
def _isolated_accounts_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    db_path = tmp_path / "accounts.db"
    monkeypatch.setenv("ENERGETICA_ACCOUNTS_DB_PATH", str(db_path))
    yield db_path
    # Drop the per-path schema-bootstrap cache so a later test reusing a path can't hit a
    # silent "no such table" from skipped schema creation.
    _reset_initialised_paths()
