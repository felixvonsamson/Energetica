"""Players' feedback on a Workshop Run: how fun it was, how well it taught the electricity market, and a comment.

Once the session is :class:`~energetica.workshop.session.Finished` and the final scores are up, each player can rate
the game. Each player has one response. Sending it again replaces it.

The responses live in their own SQLite database beside the session file, in a single ``feedback`` table, rather than
in the session. That keeps them apart from the game state, so they survive the Run starting over, and they are easy
to extract: ``scripts/download-instance.sh`` backs them up with the rest of ``instance/``, and

    sqlite3 -header -csv instance/workshop_feedback.sqlite3 "SELECT * FROM feedback"

prints them as CSV. Each row names its Run, so the tables of several Runs can be put together.
"""

from __future__ import annotations

import sqlite3
from contextlib import closing
from datetime import datetime
from pathlib import Path

from pydantic import BaseModel, Field

from energetica.workshop.game_error import WorkshopError, WorkshopErrorCode

# Relative to the instance directory that systemd pins as the working directory, beside the session file.
FEEDBACK_PATH = Path("instance/workshop_feedback.sqlite3")

# The longest comment a player can send, in characters.
COMMENT_MAX_LENGTH = 4000

_SCHEMA = """
CREATE TABLE IF NOT EXISTS feedback (
    account_id INTEGER PRIMARY KEY,
    run_slug TEXT,
    username TEXT NOT NULL,
    team TEXT,
    fun INTEGER NOT NULL CHECK (fun BETWEEN 1 AND 5),
    teaching INTEGER NOT NULL CHECK (teaching BETWEEN 1 AND 5),
    comment TEXT,
    submitted_at TEXT NOT NULL
)
"""


class FeedbackNotOpenError(WorkshopError):
    """Raised when sending feedback before the session is finished."""

    code = WorkshopErrorCode.WORKSHOP_FEEDBACK_NOT_OPEN


class WorkshopFeedback(BaseModel):
    """One player's feedback on the game."""

    fun: int = Field(ge=1, le=5, description="How fun the game was, from 1 to 5 stars")
    teaching: int = Field(
        ge=1, le=5, description="How well the game taught how the electricity market works, from 1 to 5 stars"
    )
    comment: str | None = Field(
        default=None, max_length=COMMENT_MAX_LENGTH, description="Anything else the player wants to say, if anything"
    )


class FeedbackStore:
    """The SQLite database at :attr:`path` that holds every player's feedback. Created on the first write."""

    def __init__(self, path: Path, *, run_slug: str | None) -> None:
        self.path = path
        self.run_slug = run_slug

    def _connect(self) -> sqlite3.Connection:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path)
        connection.execute(_SCHEMA)
        return connection

    def save(
        self, *, account_id: int, username: str, team: str | None, feedback: WorkshopFeedback, submitted_at: datetime
    ) -> None:
        """Save ``feedback`` as the player's response, in place of any they sent before."""
        comment = (feedback.comment or "").strip() or None
        with closing(self._connect()) as connection, connection:
            connection.execute(
                "INSERT OR REPLACE INTO feedback "
                "(account_id, run_slug, username, team, fun, teaching, comment, submitted_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    account_id,
                    self.run_slug,
                    username,
                    team,
                    feedback.fun,
                    feedback.teaching,
                    comment,
                    submitted_at.isoformat(),
                ),
            )

    def get(self, account_id: int) -> WorkshopFeedback | None:
        """The player's response, or ``None`` if they have not sent one."""
        if not self.path.exists():
            return None
        with closing(self._connect()) as connection:
            row = connection.execute(
                "SELECT fun, teaching, comment FROM feedback WHERE account_id = ?", (account_id,)
            ).fetchone()
        if row is None:
            return None
        return WorkshopFeedback(fun=row[0], teaching=row[1], comment=row[2])
