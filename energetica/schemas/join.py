"""Schema for the public join-link surface (#1021)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Viewer(BaseModel):
    """The signed-in visitor's identity and standing relative to this instance."""

    username: str
    membership: Literal["player", "facilitator"] | None = Field(
        description="'player' if the visitor is already a member, 'facilitator' if they hold a "
        "facilitator/moderator grant covering this instance (and so can't also join it as a player, "
        "per ADR-0004), or `null` if they haven't joined yet."
    )


class JoinLinkOut(BaseModel):
    """
    What a join link resolves to.

    Contains all the information needed for the confirmation screen.
    """

    instance_name: str = Field(description="This instance's display name, for the 'Join <name>?' prompt.")
    join_open: bool = Field(description="Whether the join link currently admits new accounts.")
    viewer: Viewer | None = Field(
        description="The visitor's identity and membership state, or `null` if they don't have a valid "
        "SSO session yet — `null` means they must first log in/sign up before joining."
    )
