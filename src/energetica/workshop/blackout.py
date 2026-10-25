"""What a blackout does to the rest of its Round, and what it costs the players (#1005, #1286).

A blackout takes the grid down for a day (:mod:`~energetica.workshop.trading`). When it restarts, electricity is
rationed: demand is cut by :data:`~energetica.workshop.trading.RATIONING` for the rest of the Round, and again after
each blackout that follows. The next Round starts with demand back at its full level.

Each blackout in a Round also costs every player :data:`BLACKOUT_COST_SHARE` of the operating profit the blackouts
before it left them, charged when its Recap opens: ``n`` blackouts leave them ``(1 - BLACKOUT_COST_SHARE) ** n`` of it.
Compounding the cost this way keeps a Round with several blackouts from taking all of a player's profit. Taking a share rather than a fixed sum costs the players earning most
the most, which closes the gap to the others. A player who made a loss pays nothing. The cost comes out of cash but
is left out of the score (:mod:`~energetica.workshop.score`), like the floor top-up.
"""

from __future__ import annotations

from collections.abc import Iterable

from pydantic import BaseModel, ConfigDict, Field

from energetica.workshop.seasons import SEASONS, Season
from energetica.workshop.trading import RATIONING

#: The share of a Round's operating profit each blackout in it costs, on what the blackouts before it left.
BLACKOUT_COST_SHARE = 0.3


class Blackout(BaseModel):
    """When the grid went down."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    round: int
    season: Season
    day: int = Field(description="The day of the year it happened on, from 0")
    minute: int = Field(description="The minute of the day it happened at, from 0")


def round_blackouts(blackouts: Iterable[Blackout], round_number: int) -> list[Blackout]:
    """Those of ``blackouts`` that happened in Round ``round_number``, in order."""
    return [blackout for blackout in blackouts if blackout.round == round_number]


def rationing(blackouts: Iterable[Blackout], round_number: int, season: Season) -> float:
    """What demand is multiplied by as Round ``round_number``'s Trading period in ``season`` starts, after the
    ``blackouts`` earlier in the Round.
    """
    earlier = [
        blackout
        for blackout in round_blackouts(blackouts, round_number)
        if SEASONS.index(blackout.season) < SEASONS.index(season)
    ]
    return RATIONING ** len(earlier)


def blackout_cost_share(count: int) -> float:
    """The share of a Round's operating profit that ``count`` blackouts in it cost, from 0 to 1."""
    return 1.0 - (1.0 - BLACKOUT_COST_SHARE) ** count


def blackout_cost(operating_profit: float, count: int) -> float:
    """What ``count`` blackouts in a Round cost a player whose operating profit for it was ``operating_profit``."""
    return blackout_cost_share(count) * max(0.0, operating_profit)
