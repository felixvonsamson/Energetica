"""Policy votes (#1014): players decide together whether a carbon tax applies.

The facilitator proposes the tax by turning on a Round's ``carbon_tax_vote`` lever
(:mod:`~energetica.workshop.round_plan`). Like every lever, it locks when the Recap before the Round opens, and that
Recap announces the coming vote. The vote is part of the Round's Investment phase: players cast a yes or no ballot
while the phase is open, and can change it until it closes. Nobody sees the tally, not even the facilitator; everyone
sees only the result, announced when the Round's first Trading period opens.

The vote passes with more yes than no among the ballots cast. A player who does not vote is not counted, and a tie or
a vote with no ballots fails. A carbon tax that passes is in force from that Round's Trading periods on, for the rest
of the session: nothing turns it off. The lever only starts a vote, so once a vote closes, pass or fail, it is turned
off for the later Rounds, and the facilitator turns it on again to propose the tax again after a failed vote.

The tax itself is settled once per Trading period (#1015), at :data:`CARBON_TAX_RATE`, by
:mod:`~energetica.workshop.carbon_tax`.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

#: What the carbon tax charges per kg of CO₂ emitted. Shown on the ballot. A placeholder until the game-balance pass
#: (#1145): about a quarter of a coal burner's default price per MWh, and a fifth of a gas burner's.
CARBON_TAX_RATE = 0.1

Ballot = Literal["yes", "no"]


class VoteOutcome(BaseModel):
    """The result of a Round's vote on a carbon tax."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    round: int = Field(ge=1)
    passed: bool


def passes(ballots: Iterable[Ballot]) -> bool:
    """Whether a vote with ``ballots`` passes: more yes than no. A tie, or no ballot at all, fails."""
    ballots = list(ballots)
    return ballots.count("yes") > ballots.count("no")


def carbon_tax_since(outcomes: Iterable[VoteOutcome]) -> int | None:
    """The Round whose vote put the carbon tax in force, or None if no vote has passed."""
    return next((outcome.round for outcome in outcomes if outcome.passed), None)


def vote_held(*, lever: bool, round_number: int, outcomes: Iterable[VoteOutcome]) -> bool:
    """Whether Round ``round_number`` holds a vote: its lever is on, and no earlier Round's vote passed."""
    since = carbon_tax_since(outcomes)
    return lever and (since is None or since >= round_number)
