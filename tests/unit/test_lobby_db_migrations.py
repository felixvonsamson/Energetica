"""Tests for the lobby service's schema migrations (``lobby_service.schema.upgrade_database``).

The state version lives in SQLite's ``PRAGMA user_version``. A new database is created at the
current schema and stamped at the latest version. An older one runs every pending step, and the
version bump, in one transaction.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from lobby_service.schema import SCHEMA_VERSION, SchemaTooNewError, load_steps, upgrade_database


def _user_version(path: Path) -> int:
    with sqlite3.connect(path) as conn:
        return conn.execute("PRAGMA user_version").fetchone()[0]


def _tables(path: Path) -> set[str]:
    with sqlite3.connect(path) as conn:
        return {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}


def test_a_new_database_is_created_at_the_latest_version(tmp_path: Path) -> None:
    path = tmp_path / "lobby.db"

    upgrade_database(path)

    assert _user_version(path) == SCHEMA_VERSION
    assert {"accounts", "instance_membership"} <= _tables(path)


# The shapes ``accounts.db`` had before it carried a state version, oldest first. Old code created
# them with ``CREATE TABLE IF NOT EXISTS`` and patched them up with ``PRAGMA table_info`` checks,
# which migration 1 takes over.
_ACCOUNTS_TABLE = """
    CREATE TABLE accounts (
        account_id INTEGER PRIMARY KEY,
        username   TEXT    NOT NULL UNIQUE,
        email      TEXT             UNIQUE,
        pwhash     TEXT    NOT NULL,
        created_at TEXT    NOT NULL
    )
"""
_LEGACY_SHAPES = {
    # Before the role column: every row was a settled player.
    "before-role": """
        CREATE TABLE instance_membership (
            account_id INTEGER NOT NULL,
            slug       TEXT    NOT NULL,
            settled_at TEXT    NOT NULL,
            PRIMARY KEY (account_id, slug)
        )
    """,
    # After role, before a separate settled_at (#1030): every player row had settled.
    "before-settled-at": """
        CREATE TABLE instance_membership (
            account_id INTEGER NOT NULL,
            slug       TEXT,
            role       TEXT    NOT NULL DEFAULT 'player',
            created_at TEXT    NOT NULL,
            PRIMARY KEY (account_id, slug)
        )
    """,
}


def _shape(path: Path) -> dict[str, object]:
    """Each table's columns and each index's definition: what must match between a migrated
    database and a new one. The ``CREATE TABLE`` text itself may differ (comments, spacing).
    """
    with sqlite3.connect(path) as conn:
        tables = [row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")]
        shape: dict[str, object] = {
            table: [tuple(column) for column in conn.execute(f"PRAGMA table_info({table})")] for table in tables
        }
        shape["indexes"] = sorted(
            (row[0], row[1])
            for row in conn.execute("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL")
        )
    return shape


def _legacy_database(path: Path, membership_table: str) -> None:
    with sqlite3.connect(path) as conn:
        conn.execute("PRAGMA journal_mode=WAL")  # as old code set it, so the backup copes with a -wal file
        conn.execute(_ACCOUNTS_TABLE)
        conn.execute(membership_table)
        conn.execute(
            "INSERT INTO accounts (username, pwhash, created_at) VALUES ('alice', 'hash', '2026-01-01T00:00:00+00:00')"
        )


def test_every_legacy_shape_migrates_to_the_shape_of_a_new_database(tmp_path: Path) -> None:
    new = tmp_path / "new.db"
    upgrade_database(new)

    for name, membership_table in _LEGACY_SHAPES.items():
        legacy = tmp_path / f"{name}.db"
        _legacy_database(legacy, membership_table)

        upgrade_database(legacy)

        assert _user_version(legacy) == SCHEMA_VERSION, name
        assert _shape(legacy) == _shape(new), name


def test_migration_keeps_rows_and_backfills_them_as_settled_players(tmp_path: Path) -> None:
    path = tmp_path / "lobby.db"
    _legacy_database(path, _LEGACY_SHAPES["before-role"])
    with sqlite3.connect(path) as conn:
        conn.execute("INSERT INTO instance_membership VALUES (1, 'spring', '2026-03-02T00:00:00+00:00')")

    upgrade_database(path)

    with sqlite3.connect(path) as conn:
        rows = conn.execute("SELECT account_id, slug, role, created_at, settled_at FROM instance_membership").fetchall()
        usernames = [row[0] for row in conn.execute("SELECT username FROM accounts")]
    assert rows == [(1, "spring", "player", "2026-03-02T00:00:00+00:00", "2026-03-02T00:00:00+00:00")]
    assert usernames == ["alice"]


def test_a_database_newer_than_the_code_refuses_to_start(tmp_path: Path) -> None:
    path = tmp_path / "lobby.db"
    upgrade_database(path)
    with sqlite3.connect(path) as conn:
        conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION + 1}")

    with pytest.raises(SchemaTooNewError):
        upgrade_database(path)

    assert _user_version(path) == SCHEMA_VERSION + 1


def test_migrating_keeps_one_copy_of_the_database_from_before(tmp_path: Path) -> None:
    path = tmp_path / "lobby.db"
    backup = tmp_path / "lobby.db.pre-migration"
    _legacy_database(path, _LEGACY_SHAPES["before-role"])

    upgrade_database(path)

    assert _user_version(backup) == 0
    assert "role" not in {row[1] for row in sqlite3.connect(backup).execute("PRAGMA table_info(instance_membership)")}

    # The next migration overwrites the copy with the database as it was just before it.
    def add_nickname(conn: sqlite3.Connection) -> None:
        conn.execute("ALTER TABLE accounts ADD COLUMN nickname TEXT")

    upgrade_database(path, steps=[*load_steps(), add_nickname])

    assert _user_version(backup) == SCHEMA_VERSION


def test_a_database_already_up_to_date_is_not_copied(tmp_path: Path) -> None:
    path = tmp_path / "lobby.db"
    upgrade_database(path)
    upgrade_database(path)

    assert not (tmp_path / "lobby.db.pre-migration").exists()


def test_a_failing_step_leaves_the_database_as_it_was(tmp_path: Path) -> None:
    path = tmp_path / "lobby.db"
    upgrade_database(path)

    def half_done(conn: sqlite3.Connection) -> None:
        conn.execute("ALTER TABLE accounts ADD COLUMN nickname TEXT")
        raise RuntimeError("step failed halfway")

    with pytest.raises(RuntimeError, match="halfway"):
        upgrade_database(path, steps=[*load_steps(), half_done])

    assert _user_version(path) == SCHEMA_VERSION
    assert "nickname" not in {row[1] for row in sqlite3.connect(path).execute("PRAGMA table_info(accounts)")}
