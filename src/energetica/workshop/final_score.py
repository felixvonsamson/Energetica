"""The final score, and the scoreboard shown once the session is over (#1017, #1222).

A player's final score is everything they earned minus everything they spent, plus what their fleet is still worth:

``score = operating_profit - investments - carbon_tax + residual_value``

- **Operating profit** is summed over the whole session (:mod:`~energetica.workshop.operating_profit`).
- **Investments** is what the player paid for every facility they bought, price shocks included, plus the cost of
  their loan if they took one (#1225): what it took back in payments less what it brought in.
- **Carbon tax** is what they paid in carbon tax over the session, less their shared payback.
- **Residual value** is what the facilities they still own are worth.

Cash is left out. Operating profit minus investments and the carbon tax is exactly how much a player's cash
changed over the session, apart from the floor top-up and the blackout reset (#1016). It also equals the sum of
every Round's ``net_profit`` and ``financing_total`` on the balance sheet (:mod:`~energetica.workshop.balance_sheet`). Adding cash on top
would count the operating profit twice. Cash also moves with the top-up and the reset, which say nothing about how well a player did.
Leaving cash out means neither changes anyone's score, even when they cover a loan payment. A player who overspends on facilities or goes deep into
debt keeps that loss in their score, and causing a blackout gains a trailing player nothing.

A facility's residual value is its catalog price, scaled by the share of its lifetime it has left once the session
is over: ``base_price × remaining_lifetime_rounds / lifetime_rounds``. The Rounds left are counted from the Round
after the last one, so a facility that worked its final Round in the last Round is worth nothing. One still under
construction at the end keeps its whole lifetime, so it pays back its full catalog price. Any price shock the player
paid is left out. Only the facility counts: the energy a storage facility still holds is worth nothing.
"""

from __future__ import annotations

from collections.abc import Iterable

from pydantic import BaseModel, Field

from energetica.workshop.facilities import CATALOG
from energetica.workshop.fleet import OwnedFacility, lifetime_left
from energetica.workshop.loan import LOAN_COST
from energetica.workshop.operating_profit import session_operating_profit
from energetica.workshop.player import WorkshopPlayer


class FinalScore(BaseModel):
    """One player's final score and what it adds up from."""

    account_id: int
    username: str
    operating_profit: float = Field(description="Operating profit over the whole session")
    investments: float = Field(
        description="What the player paid for every facility they bought, plus the cost of their loan if they took one"
    )
    carbon_tax: float = Field(description="The carbon tax the player paid over the session, less their shared payback")
    residual_value: float = Field(description="What the facilities they still own are worth")
    score: float = Field(description="operating_profit - investments - carbon_tax + residual_value")


def residual_value(owned: OwnedFacility, *, round_count: int) -> float:
    """What ``owned`` is worth at the end of a session of ``round_count`` Rounds."""
    facility = CATALOG[owned.facility]
    left = lifetime_left(owned, current_round=round_count + 1)
    return facility.base_price * left.rounds / facility.lifetime_rounds


def final_score(player: WorkshopPlayer, *, round_count: int) -> FinalScore:
    """``player``'s final score at the end of a session of ``round_count`` Rounds."""
    operating_profit = session_operating_profit(player.trading_results)
    investments = sum(purchase.price for purchase in player.purchases) + (LOAN_COST if player.loan else 0.0)
    carbon_tax = sum(result.carbon_tax for result in player.trading_results)
    residual = sum(residual_value(owned, round_count=round_count) for owned in player.owned_facilities)
    return FinalScore(
        account_id=player.account_id,
        username=player.username,
        operating_profit=operating_profit,
        investments=investments,
        carbon_tax=carbon_tax,
        residual_value=residual,
        score=operating_profit - investments - carbon_tax + residual,
    )


def scoreboard(players: Iterable[WorkshopPlayer], *, round_count: int) -> list[FinalScore]:
    """Every player's final score, highest first. Players on the same score keep the order they joined in."""
    scores = [final_score(player, round_count=round_count) for player in players]
    return sorted(scores, key=lambda score: score.score, reverse=True)
