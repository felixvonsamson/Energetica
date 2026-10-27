"""
Add ``accounts.expires_at``: when a temporary account is deleted (#1383).

``NULL`` means a permanent account, which every existing account is. Operator tooling creates
temporary accounts for one workshop, and the lobby service deletes each one once its date has
passed. This is safe only because account ids are never reused (migration 4).
"""

from __future__ import annotations

import sqlite3


def migrate(conn: sqlite3.Connection) -> None:
    conn.execute("ALTER TABLE accounts ADD COLUMN expires_at TEXT")
