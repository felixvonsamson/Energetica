"""The score, and the scoreboard players can follow all game (#1017, #1222, #1250).

A player's score is everything they earned minus everything they spent, plus what their fleet is still worth:

``score = operating_profit - investments - carbon_tax + residual_value``

- **Operating profit** is summed over the Rounds completed so far (:mod:`~energetica.workshop.operating_profit`).
- **Investments** is what the player paid for every facility they bought, price shocks included, plus the cost of
  their loan if they took one (#1225): what it takes back in payments less what it brings in.
- **Carbon tax** is what they paid in carbon tax, less their shared payback.
- **Residual value** is what the facilities they still own are worth.

The score only counts Rounds that are completed, so it changes once per Round, when its Recap opens. Before that, a
Round's purchases, loan and Trading periods are left out. Once the last Round is completed, the score is final. In
effect, the score is each player's capital so far.

Cash is left out. Operating profit minus investments and the carbon tax is exactly how much a player's cash
changed over the session, apart from the floor top-up and the blackout reset (#1016). It also equals the sum of
every Round's ``net_profit`` and ``financing_total`` on the balance sheet (:mod:`~energetica.workshop.balance_sheet`). Adding cash on top
would count the operating profit twice. Cash also moves with the top-up and the reset, which say nothing about how well a player did.
Leaving cash out means neither changes anyone's score, even when they cover a loan payment. A player who overspends on facilities or goes deep into
debt keeps that loss in their score, and causing a blackout gains a trailing player nothing.

A facility's residual value is its catalog price, scaled by the share of its lifetime it has left after the last
completed Round: ``base_price × remaining_lifetime_rounds / lifetime_rounds``. The Rounds left are counted from the
Round after it, so at the end of the session a facility that worked its final Round in the last Round is worth
nothing. One still under construction keeps its whole lifetime, so it pays back its full catalog price. Any price
shock the player paid is left out. Only the facility counts: the energy a storage facility still holds is worth nothing.
"""

from __future__ import annotations

from collections.abc import Iterable

from pydantic import BaseModel, Field

from energetica.workshop.facilities import CATALOG
from energetica.workshop.fleet import OwnedFacility, lifetime_left
from energetica.workshop.loan import LOAN_COST
from energetica.workshop.operating_profit import session_operating_profit
from energetica.workshop.player import WorkshopPlayer


class Score(BaseModel):
    """One player's score after the Rounds completed so far, and what it adds up from."""

    account_id: int
    username: str
    operating_profit: float = Field(description="Operating profit over the Rounds completed so far")
    investments: float = Field(
        description="What the player paid for every facility they bought, plus the cost of their loan if they took one"
    )
    carbon_tax: float = Field(description="The carbon tax the player paid, less their shared payback")
    residual_value: float = Field(description="What the facilities they still own are worth")
    score: float = Field(description="operating_profit - investments - carbon_tax + residual_value")


def residual_value(owned: OwnedFacility, *, completed_rounds: int) -> float:
    """What ``owned`` is worth once ``completed_rounds`` Rounds are completed."""
    facility = CATALOG[owned.facility]
    left = lifetime_left(owned, current_round=completed_rounds + 1)
    return facility.base_price * left.rounds / facility.lifetime_rounds


def score(player: WorkshopPlayer, *, completed_rounds: int) -> Score:
    """``player``'s score once ``completed_rounds`` Rounds are completed. Anything from a later Round is left out."""
    results = [result for result in player.trading_results if result.round <= completed_rounds]
    operating_profit = session_operating_profit(results)
    purchases = sum(purchase.price for purchase in player.purchases if purchase.round <= completed_rounds)
    loan_cost = LOAN_COST if player.loan is not None and player.loan.round <= completed_rounds else 0.0
    carbon_tax = sum(result.carbon_tax for result in results)
    residual = sum(
        residual_value(owned, completed_rounds=completed_rounds)
        for owned in player.owned_facilities
        if owned.built_round <= completed_rounds
    )
    return Score(
        account_id=player.account_id,
        username=player.username,
        operating_profit=operating_profit,
        investments=purchases + loan_cost,
        carbon_tax=carbon_tax,
        residual_value=residual,
        score=operating_profit - purchases - loan_cost - carbon_tax + residual,
    )


class Scoreboard(BaseModel):
    """Every player's score after the Rounds completed so far, highest first."""

    completed_rounds: int = Field(ge=0, description="How many Rounds the scores count")
    final: bool = Field(description="Whether the session is over, so the scores are final")
    scores: list[Score]


def ranked(players: Iterable[WorkshopPlayer], *, completed_rounds: int) -> list[Score]:
    """Every player's score once ``completed_rounds`` Rounds are completed, highest first. Players on the same score
    keep the order they joined in.
    """
    scores = [score(player, completed_rounds=completed_rounds) for player in players]
    return sorted(scores, key=lambda player_score: player_score.score, reverse=True)
