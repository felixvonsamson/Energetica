"""
The ``lobby.db`` schema and its migrations.

The database's state version lives in SQLite's ``PRAGMA user_version``. A database that has never
been stamped is at version 0. :func:`upgrade_database` runs at service start-up, before the service
accepts connections, and does one of three things:

- A new database (no tables yet) is created directly at the current schema and stamped at
  :data:`SCHEMA_VERSION`. It never runs the migration steps.
- An older database runs every pending step from ``lobby_service/migrations/``, then the version
  bump, all in one transaction. Before that, it is copied to ``<name>.pre-migration`` with SQLite's
  online backup, overwriting the copy from the previous migration.
- A database stamped newer than this code makes the service refuse to start. There are no down
  migrations.
"""

from __future__ import annotations

import importlib
import pkgutil
import sqlite3
from collections.abc import Callable, Sequence
from pathlib import Path

from lobby_service import migrations


def create_current_schema(conn: sqlite3.Connection) -> None:
    """Create every table and index at the current schema, in an empty database."""
    conn.execute(
        """
        CREATE TABLE accounts (
            account_id INTEGER PRIMARY KEY AUTOINCREMENT,  -- never reused, even after a delete
            username   TEXT    NOT NULL UNIQUE,
            email      TEXT             UNIQUE,
            pwhash     TEXT    NOT NULL,
            created_at TEXT    NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE instance_membership (
            account_id INTEGER NOT NULL,
            slug       TEXT,                        -- NULL = server-wide (facilitator only)
            role       TEXT    NOT NULL DEFAULT 'player',
            created_at TEXT    NOT NULL,             -- ISO-8601 UTC; joined_at for a player,
                                                      -- granted_at for a facilitator
            PRIMARY KEY (account_id, slug)
        )
        """
    )
    # SQLite treats every NULL as distinct in a unique index, so the primary key does not stop two
    # server-wide (slug IS NULL) rows for the same account. This partial index does.
    conn.execute(
        "CREATE UNIQUE INDEX instance_membership_one_server_wide_row_per_account "
        "ON instance_membership (account_id) WHERE slug IS NULL"
    )
    conn.execute(
        """
        CREATE TABLE runs (
            slug          TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            mode          TEXT NOT NULL CHECK (mode IN ('freeplay', 'workshop')),
            advertised    INTEGER NOT NULL,
            access_policy TEXT NOT NULL CHECK (access_policy IN ('public', 'private')),
            join_token    TEXT UNIQUE,              -- only on a private run
            join_open     INTEGER NOT NULL DEFAULT 0,
            starts_at     TEXT NOT NULL,            -- ISO-8601 UTC, in the one format the service
            freeze_at     TEXT,                     -- writes, so the CHECKs below can compare
            ended_at      TEXT,                     -- them as text
            created_at    TEXT NOT NULL,
            CHECK (freeze_at IS NULL OR freeze_at >= starts_at),
            CHECK (ended_at IS NULL OR ended_at >= COALESCE(freeze_at, starts_at))
        )
        """
    )


Step = Callable[[sqlite3.Connection], None]


class SchemaTooNewError(Exception):
    """The database was migrated by newer code than this. The service refuses to start on it."""


def load_steps() -> list[Step]:
    """
    The ``migrate`` function of every module in ``lobby_service/migrations/``, in order.

    Fails loudly if the numbering has a gap or a duplicate, since a step would then be skipped or
    run at the wrong version.
    """
    names = sorted(module.name for module in pkgutil.iter_modules(migrations.__path__))
    steps: list[Step] = []
    for expected, name in enumerate(names, start=1):
        number = name.split("_", 1)[0]
        if number != f"{expected:04d}":
            raise RuntimeError(f"lobby.db migrations are misnumbered: expected {expected:04d}_*, found {name}")
        steps.append(importlib.import_module(f"{migrations.__name__}.{name}").migrate)
    return steps


SCHEMA_VERSION = len(load_steps())
"""The state version this code writes and expects: the number of the last migration step."""


def backup_path(path: Path) -> Path:
    """Where the copy of the database from just before the last migration is kept."""
    return path.with_name(f"{path.name}.pre-migration")


def upgrade_database(path: Path, *, steps: Sequence[Step] | None = None) -> None:
    """
    Bring the database at ``path`` up to the latest state version, creating it if absent.

    ``steps`` defaults to the real migration steps. Tests pass their own to append one.
    """
    steps = load_steps() if steps is None else list(steps)
    target = len(steps)
    path.parent.mkdir(parents=True, exist_ok=True)
    # isolation_level=None turns off the sqlite3 module's own transaction handling, so the BEGIN and
    # COMMIT below are the only ones and every step plus the version bump share one transaction.
    conn = sqlite3.connect(path, isolation_level=None)
    try:
        conn.execute("BEGIN IMMEDIATE")
        try:
            version = conn.execute("PRAGMA user_version").fetchone()[0]
            if version > target:
                raise SchemaTooNewError(
                    f"{path} is at state version {version}, but this code only knows up to {target}; "
                    "refusing to start (there are no down migrations)"
                )
            is_new = conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table'").fetchone() is None
            if is_new:
                create_current_schema(conn)
            elif version < target:
                _back_up(path, backup_path(path))
                for step in steps[version:]:
                    step(conn)
            conn.execute(f"PRAGMA user_version = {target}")
        except BaseException:
            conn.execute("ROLLBACK")
            raise
        conn.execute("COMMIT")
    finally:
        conn.close()


def _back_up(source: Path, destination: Path) -> None:
    """
    Copy the database to ``destination`` with SQLite's online backup, replacing any older copy.

    The caller holds the write lock, so nothing changes while the copy is taken. The copy reads
    through a second connection because SQLite refuses to back up through a connection that holds
    the write lock. The backup includes anything still in the ``-wal`` file.
    """
    destination.unlink(missing_ok=True)
    reader = sqlite3.connect(source)
    target = sqlite3.connect(destination)
    try:
        reader.backup(target)
    finally:
        target.close()
        reader.close()
