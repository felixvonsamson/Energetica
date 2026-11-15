"""
Drop ``instance_membership.settled_at``.

Nothing has read the column since #1138. Runs on code from before #1283 wrote it at settle, and
migration 1 kept it for them. Since #1284 no run opens the database, so nothing writes it either.
Whether an account has settled is a fact of the run: a ``Player`` with its ``account_id``.
"""

from __future__ import annotations

import sqlite3


def migrate(conn: sqlite3.Connection) -> None:
    conn.execute("ALTER TABLE instance_membership DROP COLUMN settled_at")
