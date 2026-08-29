"""Schemas for the facilitator instance-admin surface (#1020)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class FacilitatorAccessOut(BaseModel):
    """This instance's join-link settings, as shown on the facilitator page."""

    join_token: str = Field(description="The unguessable token encoded in the join link; generated on first read.")
    join_open: bool = Field(description="Whether the join link currently admits new accounts.")


class FacilitatorAccessPatch(BaseModel):
    """Request body to flip whether the join link currently admits new accounts."""

    join_open: bool
