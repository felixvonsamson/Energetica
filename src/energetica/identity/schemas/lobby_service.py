"""
The bodies of the lobby service's internal API (``/internal/v1``, ADR-0009).

Shared by the service (:mod:`lobby_service.app`) and its client
(:mod:`energetica.identity.lobby_service_client`), so the two cannot drift apart. The API only grows
by additions: a field can be added here, but renaming or removing one needs a new API version.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field

from energetica.identity.instance_config import Phase, RunModeTag

API_PREFIX = "/internal/v1"
"""The path every endpoint of the current API version is under."""

API_VERSIONS = ["v1"]
"""The API versions the service serves, reported by ``healthz``."""

CALLER_HEADER = "X-Energetica-Caller"
"""The request header a client names itself in, for the service's logs. Never used for trust."""

ACTING_ACCOUNT_HEADER = "X-Energetica-Acting-Account"
"""
The request header naming the account a write is made for, such as the facilitator whose change a
run relays. Only logged, with the run write it accompanies. Never used for trust.
"""

MIN_PASSWORD_LENGTH = 7


class LobbyServiceErrorCode(StrEnum):
    """
    The ``detail`` of an error response from the service, so a client can tell errors that
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
    RUN_NOT_FOUND = "RUN_NOT_FOUND"
    RUN_EXISTS = "RUN_EXISTS"
    INVALID_RUN = "INVALID_RUN"
    RUN_HAS_MEMBERS = "RUN_HAS_MEMBERS"


class Credentials(BaseModel):
    """A username and password: the body of ``POST sessions``."""

    username: str
    password: str


class NewAccount(Credentials):
    """
    The body of ``POST accounts``. With ``expires_at``, the account is a temporary account, which the
    service deletes once that time has passed. Only operator tooling sets it; signup never does.
    """

    expires_at: AwareDatetime | None = None


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
    expires_at: str | None = Field(description="When a temporary account is deleted; null for a permanent account")


class SessionOut(AccountOut):
    """
    The account a session token belongs to, and its standing in one run.

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


class GrantedRun(BaseModel):
    slug: str
    granted_at: str


class MembershipsOut(BaseModel):
    """
    An account's player memberships and run-scoped facilitator grants, most recent first. Runs
    since deleted are included; the caller drops them.
    """

    runs: list[JoinedRun]
    facilitated_runs: list[GrantedRun]


class RunMember(BaseModel):
    account_id: int
    username: str
    joined_at: str


class FacilitatorGrantRequest(BaseModel):
    """The body of ``PUT facilitator-grants/{account_id}``. No slug means a server-wide grant."""

    slug: str | None = None


AccessPolicyTag = Literal["public", "private"]


class RunOut(BaseModel):
    """
    A run's config, and its ``phase`` at the time of the answer, derived from the three
    timestamps with :func:`energetica.identity.instance_config.derive_phase`.
    """

    slug: str
    name: str
    mode: RunModeTag
    advertised: bool
    access_policy: AccessPolicyTag
    join_token: str | None
    join_open: bool
    starts_at: datetime
    freeze_at: datetime | None
    ended_at: datetime | None
    created_at: str
    phase: Phase


class RunCreate(BaseModel):
    """
    The body of ``PUT runs/{slug}``, which creates a run. ``join_token`` and ``join_open`` are
    here so that a run's config can be copied in from its ``instance.json``.
    """

    model_config = {"extra": "forbid"}

    name: str
    mode: RunModeTag
    advertised: bool
    access_policy: AccessPolicyTag
    join_token: str | None = None
    join_open: bool = False
    starts_at: AwareDatetime
    freeze_at: AwareDatetime | None = None
    ended_at: AwareDatetime | None = None


class RunUpdate(BaseModel):
    """
    The body of ``PATCH runs/{slug}``: the fields to change, and only those. A field sent as
    ``null`` is cleared. ``slug`` and ``mode`` cannot change, so a body naming either is refused.
    """

    model_config = {"extra": "forbid"}

    name: str | None = None
    advertised: bool | None = None
    access_policy: AccessPolicyTag | None = None
    join_token: str | None = None
    join_open: bool | None = None
    starts_at: AwareDatetime | None = None
    freeze_at: AwareDatetime | None = None
    ended_at: AwareDatetime | None = None


class JoinTokenOut(BaseModel):
    join_token: str


class HealthOut(BaseModel):
    status: Literal["ok"]
    schema_version: int
    api_versions: list[str]
