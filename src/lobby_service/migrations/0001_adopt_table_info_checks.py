"""Bring any unversioned ``accounts.db`` to the shape the code had when versioning started.

Before state versions, every process that opened the database created its tables with
``CREATE TABLE IF NOT EXISTS`` and patched older shapes with two ``PRAGMA table_info`` checks. This
step takes those checks over. It leaves the database exactly as those checks did, because runs on
old code keep opening the file until they are switched to the lobby service's API (ADR-0009).
"""

from __future__ import annotations

import sqlite3


def migrate(conn: sqlite3.Connection) -> None:
    _add_role_column(conn)
    _add_settled_at_column(conn)
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS instance_membership_one_server_wide_row_per_account "
        "ON instance_membership (account_id) WHERE slug IS NULL"
    )


def _columns(conn: sqlite3.Connection) -> set[str]:
    return {row[1] for row in conn.execute("PRAGMA table_info(instance_membership)")}


def _add_role_column(conn: sqlite3.Connection) -> None:
    """Rebuild a table from before the ``role`` column existed.

    That shape had ``slug`` and ``settled_at`` as NOT NULL. Every row was a settled player, since
    facilitators were not rows yet and there was no "joined but not settled" state. SQLite cannot
    relax a NOT NULL constraint, so the table is rebuilt: every row becomes ``role='player'``, with
    both ``created_at`` and ``settled_at`` taken from the old ``settled_at``.
    """
    if "role" in _columns(conn):
        return
    conn.execute(
        """
        CREATE TABLE instance_membership_new (
            account_id INTEGER NOT NULL,
            slug       TEXT,
            role       TEXT    NOT NULL DEFAULT 'player',
            created_at TEXT    NOT NULL,
            settled_at TEXT,
            PRIMARY KEY (account_id, slug)
        )
        """
    )
    conn.execute(
        "INSERT INTO instance_membership_new (account_id, slug, role, created_at, settled_at) "
        "SELECT account_id, slug, 'player', settled_at, settled_at FROM instance_membership"
    )
    conn.execute("DROP TABLE instance_membership")
    conn.execute("ALTER TABLE instance_membership_new RENAME TO instance_membership")


def _add_settled_at_column(conn: sqlite3.Connection) -> None:
    """Add ``settled_at`` to a table from after ``role`` existed but before #1030.

    Every player row of that shape had settled, so ``settled_at`` is backfilled from
    ``created_at``. Facilitator rows get none.
    """
    if "settled_at" in _columns(conn):
        return
    conn.execute("ALTER TABLE instance_membership ADD COLUMN settled_at TEXT")
    conn.execute("UPDATE instance_membership SET settled_at = created_at WHERE role = 'player'")
