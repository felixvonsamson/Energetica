"""The final score, and the scoreboard shown once the session is over (#1017).

A player's final score adds up three things: their operating profit over the whole session
(:mod:`~energetica.workshop.operating_profit`), the cash they hold at the end, and the **residual value** of the
facilities they still own.

A facility's residual value is its catalog price, scaled by the share of its lifetime it has left once the session
is over: ``base_price × remaining_lifetime_rounds / lifetime_rounds``. The Rounds left are counted from the Round
after the last one, so a facility that worked its final Round in the last Round is worth nothing. One still under
construction at the end keeps its whole lifetime, so it pays back its full catalog price. Any price shock the player
paid is left out. Only the facility counts: the energy a storage facility still holds is worth nothing.

Final cash is the cash as it stands. The floor top-up and the blackout reset (#1016) only happen as a Round starts,
so neither applies after the last Round, and residual value pays out as usual even if the grid went down in it. The
carbon tax is not part of operating profit, but it is part of cash, so it still counts.
"""

from __future__ import annotations

from collections.abc import Iterable

from pydantic import BaseModel, Field

from energetica.workshop.facilities import CATALOG
from energetica.workshop.fleet import OwnedFacility, lifetime_left
from energetica.workshop.operating_profit import session_operating_profit
from energetica.workshop.player import WorkshopPlayer


class FinalScore(BaseModel):
    """One player's final score and what it adds up from."""

    account_id: int
    username: str
    operating_profit: float = Field(description="Operating profit over the whole session")
    cash: float = Field(description="The cash the player holds at the end")
    residual_value: float = Field(description="What the facilities they still own are worth")
    score: float = Field(description="operating_profit + cash + residual_value")


def residual_value(owned: OwnedFacility, *, round_count: int) -> float:
    """What ``owned`` is worth at the end of a session of ``round_count`` Rounds."""
    facility = CATALOG[owned.facility]
    left = lifetime_left(owned, current_round=round_count + 1)
    return facility.base_price * left.rounds / facility.lifetime_rounds


def final_score(player: WorkshopPlayer, *, round_count: int) -> FinalScore:
    """``player``'s final score at the end of a session of ``round_count`` Rounds."""
    operating_profit = session_operating_profit(player.trading_results)
    residual = sum(residual_value(owned, round_count=round_count) for owned in player.owned_facilities)
    return FinalScore(
        account_id=player.account_id,
        username=player.username,
        operating_profit=operating_profit,
        cash=player.money,
        residual_value=residual,
        score=operating_profit + player.money + residual,
    )


def scoreboard(players: Iterable[WorkshopPlayer], *, round_count: int) -> list[FinalScore]:
    """Every player's final score, highest first. Players on the same score keep the order they joined in."""
    scores = [final_score(player, round_count=round_count) for player in players]
    return sorted(scores, key=lambda score: score.score, reverse=True)
