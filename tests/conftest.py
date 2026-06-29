"""Shared pytest fixtures.

The autouse `_isolated_accounts_db` fixture redirects the server-wide accounts SQLite store to a
per-test temp file. Without it, any test that calls ``create_app`` (or otherwise touches
``energetica.accounts``) would write to the dev default ``instance/accounts.db`` in the repo,
leaking state across tests and into the developer's working tree.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest

from energetica.accounts.db import _reset_initialised_paths


@pytest.fixture(autouse=True)
def _isolated_accounts_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    db_path = tmp_path / "accounts.db"
    monkeypatch.setenv("ENERGETICA_ACCOUNTS_DB_PATH", str(db_path))
    yield db_path
    # Drop the per-path schema-bootstrap cache so a later test reusing a path can't hit a
    # silent "no such table" from skipped schema creation.
    _reset_initialised_paths()
