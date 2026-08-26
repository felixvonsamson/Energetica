"""Schema for the public join-link surface (#1021)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class JoinLinkOut(BaseModel):
    """What a join link resolves to — enough for the confirmation screen, and nothing that
    requires the visitor to already be admitted onto this instance.
    """

    instance_name: str = Field(description="This instance's display name, for the 'Join <name>?' prompt.")
    join_open: bool = Field(description="Whether the join link currently admits new accounts.")
    viewer_username: str | None = Field(
        description="The visitor's username if they already have a valid SSO session, else null "
        "— null means the frontend must send them through login/signup before showing the "
        "confirmation screen."
    )
