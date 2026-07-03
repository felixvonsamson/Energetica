"""Schemas for lobby reads served from the instance (the in-run switcher's 'your runs')."""

from __future__ import annotations

from pydantic import AwareDatetime, BaseModel, Field


class MyRun(BaseModel):
    """One run the authenticated account has settled in, joined with its on-disk fragment."""

    slug: str = Field(description="Subdomain slug of the run")
    name: str = Field(description="Human-readable run name, from the instance fragment")
    starts_at: AwareDatetime = Field(description="When the run starts, from the instance fragment")
    settled_at: AwareDatetime = Field(description="When this account settled in the run")


class MyRunsResponse(BaseModel):
    """The account's settled runs, most recently settled first."""

    runs: list[MyRun]
