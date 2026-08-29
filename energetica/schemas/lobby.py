"""Schemas for lobby reads served from the instance (the in-run switcher's 'your runs')."""

from __future__ import annotations

from pydantic import AwareDatetime, BaseModel, Field


class MyRun(BaseModel):
    """One run the authenticated account has joined, joined with its on-disk fragment.

    ``settled_at`` is ``null`` for a run joined (#1030) but not yet settled in — the account has
    picked no tile there yet.
    """

    slug: str = Field(description="Subdomain slug of the run")
    name: str = Field(description="Human-readable run name, from the instance fragment")
    starts_at: AwareDatetime = Field(description="When the run starts (announced → active), from the instance fragment")
    freeze_at: AwareDatetime | None = Field(
        default=None, description="When play/sim ends (active → freeze), or null for an open-ended run"
    )
    ended_at: AwareDatetime | None = Field(
        default=None, description="When the process is reaped (freeze → ended), or null for an open-ended run"
    )
    joined_at: AwareDatetime = Field(description="When this account joined the run")
    settled_at: AwareDatetime | None = Field(
        default=None, description="When this account settled in the run, or null if not yet"
    )


class FacilitatedRun(BaseModel):
    """One run the authenticated account facilitates — an instance-scoped grant only (a
    server-wide grant isn't tied to a single run, so it has no entry here; see #1032).
    """

    slug: str = Field(description="Subdomain slug of the run")
    name: str = Field(description="Human-readable run name, from the instance fragment")
    starts_at: AwareDatetime = Field(description="When the run starts, from the instance fragment")
    freeze_at: AwareDatetime | None = Field(
        default=None, description="When play/sim ends, or null for an open-ended run"
    )
    ended_at: AwareDatetime | None = Field(
        default=None, description="When the process is reaped, or null for an open-ended run"
    )
    granted_at: AwareDatetime = Field(description="When this account was granted facilitator access to the run")


class MyRunsResponse(BaseModel):
    """The account's joined runs, most recently joined first, plus the runs it facilitates."""

    username: str = Field(description="The authenticated account's username")
    runs: list[MyRun]
    facilitated_runs: list[FacilitatedRun] = Field(
        description="Runs this account facilitates via an instance-scoped grant, most recently granted first"
    )
