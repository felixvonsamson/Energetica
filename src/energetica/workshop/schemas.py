"""Response models for Workshop's routes."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from energetica.workshop.session import Checkpoint


class WorkshopPlayerOut(BaseModel):
    """The calling account's own player in the Run."""

    account_id: int
    username: str
    money: float


class WorkshopEntryOut(BaseModel):
    """The result of entering the Run."""

    role: Literal["player", "facilitator"]
    player: WorkshopPlayerOut | None = Field(
        description="The account's player, or null for a facilitator, who moderates and does not play"
    )


class WorkshopMemberOut(BaseModel):
    """A player in the Run, as everyone in it sees them."""

    account_id: int
    username: str


class WorkshopSessionOut(BaseModel):
    """Where the session is."""

    checkpoint: Checkpoint
    round_count: int = Field(description="How many Rounds the session runs")
    players: list[WorkshopMemberOut] = Field(description="Everyone placed into the Run, in the order they entered")
