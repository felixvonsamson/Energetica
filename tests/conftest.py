"""Shared pytest fixtures.

The autouse `_isolated_accounts_db` fixture redirects the server-wide accounts SQLite store to a
per-test temp file. Without it, any test that calls ``create_app`` (or otherwise touches
``energetica.accounts``) would try to write to the production path ``/var/lib/energetica/accounts.db``.
"""

from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def _isolated_accounts_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    db_path = tmp_path / "accounts.db"
    monkeypatch.setenv("ENERGETICA_ACCOUNTS_DB_PATH", str(db_path))
    return db_path
