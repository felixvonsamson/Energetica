"""
Add the ``runs`` table: each run's config, which until now lived in its ``instance.json`` (#1313).

The table starts empty. Production's runs are copied in through the API, not here, because which
runs exist is a fact of one deployment. Nothing references the table yet: the foreign key from
``instance_membership`` comes in a later step, once every membership's run has a row.
"""

from __future__ import annotations

import sqlite3


def migrate(conn: sqlite3.Connection) -> None:
    # Copied, not taken from ``create_current_schema``, so that this step keeps doing the same thing
    # after later steps change the table.
    conn.execute(
        """
        CREATE TABLE runs (
            slug          TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            mode          TEXT NOT NULL CHECK (mode IN ('freeplay', 'workshop')),
            advertised    INTEGER NOT NULL,
            access_policy TEXT NOT NULL CHECK (access_policy IN ('public', 'private')),
            join_token    TEXT UNIQUE,
            join_open     INTEGER NOT NULL DEFAULT 0,
            starts_at     TEXT NOT NULL,
            freeze_at     TEXT,
            ended_at      TEXT,
            created_at    TEXT NOT NULL,
            CHECK (freeze_at IS NULL OR freeze_at >= starts_at),
            CHECK (ended_at IS NULL OR ended_at >= COALESCE(freeze_at, starts_at))
        )
        """
    )
