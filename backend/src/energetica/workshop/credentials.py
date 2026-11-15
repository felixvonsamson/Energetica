"""The credentials file of a Workshop Run with teams (#1385).

``scripts/lobby/setup-workshop-teams.py`` creates a temporary account for every player, and writes each account's
team, username and password here, so the facilitator can print a slip per team. The lobby service keeps only the
password hashes, so this file is the one place the plain passwords are kept. To keep that as small and short-lived
as possible, it only ever holds temporary accounts, it stays in one Run's directory, only the Run's process can read
it, and once the accounts expire the Run deletes it rather than serve it.
"""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

from pydantic import AwareDatetime, BaseModel, Field

from energetica.kernel.atomic_file import write_atomically

logger = logging.getLogger(__name__)

# Relative to the instance directory that systemd pins as the working directory, beside the session file.
CREDENTIALS_PATH = Path("instance/workshop_credentials.json")


class CredentialLine(BaseModel):
    """One account's slip line."""

    team: str
    username: str
    password: str


class WorkshopCredentials(BaseModel):
    """Every account the setup script created, in team order, and when they expire."""

    model_config = {"extra": "forbid"}

    expires_at: AwareDatetime = Field(description="When the accounts, and so this file, expire")
    accounts: list[CredentialLine]


def write_credentials(path: Path, credentials: WorkshopCredentials) -> None:
    """Write ``credentials`` to ``path``, readable and writable by its owner only."""
    write_atomically(path, credentials.model_dump_json(indent=2), mode=0o600)


def delete_expired_credentials(path: Path, *, now: datetime) -> bool:
    """Delete the credentials at ``path`` if they have expired. Return whether a file was deleted."""
    if not path.exists():
        return False
    credentials = WorkshopCredentials.model_validate_json(path.read_text(encoding="utf-8"))
    if now < credentials.expires_at:
        return False
    path.unlink(missing_ok=True)
    logger.info("Deleted the Workshop credentials at %s, which expired at %s", path, credentials.expires_at)
    return True


def read_credentials(path: Path, *, now: datetime) -> WorkshopCredentials | None:
    """The credentials at ``path``, or ``None`` if there are none. Expired credentials are deleted, not read."""
    if delete_expired_credentials(path, now=now) or not path.exists():
        return None
    return WorkshopCredentials.model_validate_json(path.read_text(encoding="utf-8"))
