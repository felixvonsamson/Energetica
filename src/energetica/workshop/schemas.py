"""Response models for Workshop's routes."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from energetica.workshop.facilities import FacilityId
from energetica.workshop.fleet import OwnedFacility, lifetime_left
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


class WorkshopPhaseTimerOut(BaseModel):
    """The running phase's countdown."""

    remaining_seconds: float = Field(
        description="Time left when the server answered. Zero once the phase has closed, though the session "
        "stays at its checkpoint until the facilitator advances it"
    )


class WorkshopPhaseExtendIn(BaseModel):
    """The facilitator's "+N minutes" on the running phase."""

    minutes: int = Field(ge=1, le=60, description="How many minutes to add")


class WorkshopSessionOut(BaseModel):
    """Where the session is."""

    checkpoint: Checkpoint
    next_checkpoint: Checkpoint | None = Field(
        description="Where the facilitator's next advance moves the session, or null once it is finished"
    )
    round_count: int = Field(description="How many Rounds the session runs")
    phase_timer: WorkshopPhaseTimerOut | None = Field(
        description="The countdown on the Investment phase or a Trading period's price-setting window, or null "
        "at a checkpoint that has none"
    )
    players: list[WorkshopMemberOut] = Field(description="Everyone placed into the Run, in the order they entered")


class WorkshopSelectionIn(BaseModel):
    """One facility to add to the calling player's selection."""

    facility: FacilityId


class WorkshopSelectionOut(BaseModel):
    """The facilities the calling player has picked in the open Investment phase (#999)."""

    facilities: list[FacilityId] = Field(
        description="One entry per copy, in the order they were picked. All are bought when the Investment "
        "phase's time runs out"
    )
    total_cost: float = Field(description="What buying the whole selection costs")
    money: float = Field(description="The player's cash. The selection can never cost more")


class WorkshopOwnedFacilityOut(BaseModel):
    """One facility the calling player owns."""

    facility: FacilityId
    built_round: int = Field(description="The Round it was bought in")
    rounds_left: int = Field(description="Rounds it still works for, counting the current one")
    under_construction: bool = Field(
        description="True while its construction lag runs. It then keeps its whole lifetime"
    )

    @classmethod
    def from_owned(cls, owned: OwnedFacility, *, current_round: int) -> WorkshopOwnedFacilityOut:
        """``owned`` as it stands in ``current_round``."""
        left = lifetime_left(owned, current_round=current_round)
        return cls(
            facility=owned.facility,
            built_round=owned.built_round,
            rounds_left=left.rounds,
            under_construction=left.under_construction,
        )
