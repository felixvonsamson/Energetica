"""
Rebuild ``accounts`` with ``AUTOINCREMENT``, so that an account id is never given out twice (#1382).

Without it, SQLite gives a new row the highest id in the table plus one, so deleting the account
with the highest id frees that id for the next signup. The session cookie and the runs know an
account only by its id, so the new account would take over the deleted one's sessions and players.

With ``AUTOINCREMENT``, SQLite keeps the highest id ever used in the ``sqlite_sequence`` table.
Copying the rows across with their ids sets it to the current highest id, so ids continue from
there. No other table has a foreign key to ``accounts``, so it can be dropped and renamed freely.
"""

from __future__ import annotations

import sqlite3


def migrate(conn: sqlite3.Connection) -> None:
    # Copied, not taken from ``create_current_schema``, so that this step keeps doing the same thing
    # after later steps change the table.
    conn.execute(
        """
        CREATE TABLE accounts_new (
            account_id INTEGER PRIMARY KEY AUTOINCREMENT,
            username   TEXT    NOT NULL UNIQUE,
            email      TEXT             UNIQUE,
            pwhash     TEXT    NOT NULL,
            created_at TEXT    NOT NULL
        )
        """
    )
    conn.execute(
        "INSERT INTO accounts_new (account_id, username, email, pwhash, created_at) "
        "SELECT account_id, username, email, pwhash, created_at FROM accounts"
    )
    conn.execute("DROP TABLE accounts")
    conn.execute("ALTER TABLE accounts_new RENAME TO accounts")
