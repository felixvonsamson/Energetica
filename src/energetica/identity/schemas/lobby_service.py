"""The bodies of the lobby service's internal API (``/internal/v1``, ADR-0009).

Shared by the service (:mod:`lobby_service.app`) and its client
(:mod:`energetica.identity.lobby_service_client`), so the two cannot drift apart. The API only grows
by additions: a field can be added here, but renaming or removing one needs a new API version.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel

API_VERSIONS = ["v1"]
"""The API versions the service serves, reported by ``healthz``."""

MIN_PASSWORD_LENGTH = 7


class LobbyServiceErrorCode(StrEnum):
    """The ``detail`` of an error response from the service, so a client can tell errors that
    share a status code apart.
    """

    USER_NOT_FOUND = "USER_NOT_FOUND"
    INVALID_PASSWORD = "INVALID_PASSWORD"
    INVALID_SESSION = "INVALID_SESSION"
    USERNAME_TAKEN = "USERNAME_TAKEN"
    PASSWORD_TOO_SHORT = "PASSWORD_TOO_SHORT"
    OLD_PASSWORD_INCORRECT = "OLD_PASSWORD_INCORRECT"
    ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND"
    ROLE_CONFLICT = "ROLE_CONFLICT"


class Credentials(BaseModel):
    """A username and password: the body of ``POST sessions`` and ``POST accounts``."""

    username: str
    password: str


class SessionToken(BaseModel):
    token: str


class CreatedAccount(BaseModel):
    account_id: int
    token: str


class AccountOut(BaseModel):
    account_id: int
    username: str
    email: str | None
    created_at: str


class SessionOut(AccountOut):
    """The account a session token belongs to, and its standing in one run.

    With a run, ``role`` is ``"facilitator"`` if a grant covers that run, and ``joined`` says whether
    the account has joined it as a player. Without a run, ``role`` is ``"facilitator"`` only for a
    server-wide grant, and ``joined`` is ``None``.
    """

    role: Literal["player", "facilitator"]
    joined: bool | None


class PasswordChange(BaseModel):
    old_password: str
    new_password: str


class JoinedRun(BaseModel):
    slug: str
    joined_at: str


class FacilitatedRun(BaseModel):
    slug: str
    granted_at: str


class MembershipsOut(BaseModel):
    """An account's player memberships and run-scoped facilitator grants, most recent first. Runs
    since deleted are included; the caller drops them.
    """

    runs: list[JoinedRun]
    facilitated_runs: list[FacilitatedRun]


class RunMember(BaseModel):
    account_id: int
    username: str
    joined_at: str


class FacilitatorGrant(BaseModel):
    """The body of ``PUT facilitator-grants/{account_id}``. No slug means a server-wide grant."""

    slug: str | None = None


class HealthOut(BaseModel):
    status: Literal["ok"]
    schema_version: int
    api_versions: list[str]
