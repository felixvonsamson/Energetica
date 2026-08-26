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


class FacilitatorRosterOut(BaseModel):
    """The private instance's roster (#1022), split by whether the account has touched this
    instance yet.
    """

    joined: list[str] = Field(description="Allowlisted usernames that already have a User on this instance.")
    invited: list[str] = Field(description="Allowlisted usernames with no User here yet.")


class RosterCandidatesOut(BaseModel):
    """Existing accounts matching a roster-search prefix — the add control's lookup."""

    usernames: list[str] = Field(description="Existing accounts' usernames starting with the search prefix.")


class RosterAddIn(BaseModel):
    """Request body to add an existing account to the roster."""

    username: str = Field(description="An existing account's username to add to the private allowlist.")
