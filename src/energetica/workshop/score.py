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
changed over the session, apart from the floor top-up (#1016) and the blackout cost (#1286). It also equals the sum
of every Round's ``net_profit``, ``blackout_cost`` and ``financing_total`` on the balance sheet
(:mod:`~energetica.workshop.balance_sheet`). Adding cash on top would count the operating profit twice. Cash also
moves with the top-up and the blackout cost, which the score leaves out. Leaving cash out means neither changes
anyone's score, even when they cover a loan payment. A player who overspends on facilities or goes deep into debt
keeps that loss in their score.

A facility's residual value is its price for the length the session started with (#1306, #1298), scaled by the share
of its lifetime it has left after the last completed Round: ``session_price × remaining_lifetime_rounds /
lifetime_rounds``. The Rounds left are counted from the Round after it, so at the end of the session a facility that
worked its final Round in the last Round is worth nothing. One still under construction keeps its whole lifetime, so it pays back its full price. Any price
shock the player paid is left out. Only the facility counts: the energy a storage facility still holds is worth nothing.

In a Run with teams (#1384), a team's score is the sum of its members' scores, times the team's bonus multiplier. The
facilitator sets the multipliers, for example to reward a quiz held outside the game. A team without one is multiplied
by 1. Players' own scores are never multiplied.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

from pydantic import BaseModel, Field

from energetica.identity.instance_config import Team
from energetica.workshop.facilities import CATALOG, session_price
from energetica.workshop.fleet import OwnedFacility, lifetime_left
from energetica.workshop.loan import LOAN_COST
from energetica.workshop.operating_profit import session_operating_profit
from energetica.workshop.player import WorkshopPlayer


class Score(BaseModel):
    """One player's score after the Rounds completed so far, and what it adds up from."""

    account_id: int
    username: str
    team: str | None = Field(description="The player's team, or None in a Run without teams")
    operating_profit: float = Field(description="Operating profit over the Rounds completed so far")
    investments: float = Field(
        description="What the player paid for every facility they bought, plus the cost of their loan if they took one"
    )
    carbon_tax: float = Field(description="The carbon tax the player paid, less their shared payback")
    residual_value: float = Field(description="What the facilities they still own are worth")
    score: float = Field(description="operating_profit - investments - carbon_tax + residual_value")


def residual_value(owned: OwnedFacility, *, completed_rounds: int, price_round_count: int) -> float:
    """What ``owned`` is worth once ``completed_rounds`` Rounds are completed, in a session priced for
    ``price_round_count`` Rounds.
    """
    facility = CATALOG[owned.facility]
    left = lifetime_left(owned, current_round=completed_rounds + 1)
    return session_price(owned.facility, price_round_count) * left.rounds / facility.lifetime_rounds


def score(player: WorkshopPlayer, *, completed_rounds: int, price_round_count: int) -> Score:
    """``player``'s score once ``completed_rounds`` Rounds are completed, in a session priced for ``price_round_count``
    Rounds. Anything from a later Round is left out.
    """
    results = [result for result in player.trading_results if result.round <= completed_rounds]
    operating_profit = session_operating_profit(results)
    purchases = sum(purchase.price for purchase in player.purchases if purchase.round <= completed_rounds)
    loan_cost = LOAN_COST if player.loan is not None and player.loan.round <= completed_rounds else 0.0
    carbon_tax = sum(result.carbon_tax for result in results)
    residual = sum(
        residual_value(owned, completed_rounds=completed_rounds, price_round_count=price_round_count)
        for owned in player.owned_facilities
        if owned.built_round <= completed_rounds
    )
    return Score(
        account_id=player.account_id,
        username=player.username,
        team=player.team,
        operating_profit=operating_profit,
        investments=purchases + loan_cost,
        carbon_tax=carbon_tax,
        residual_value=residual,
        score=operating_profit - purchases - loan_cost - carbon_tax + residual,
    )


# The parts of a score, which a team's score sums over its members.
PARTS = ("operating_profit", "investments", "carbon_tax", "residual_value")


class TeamScore(BaseModel):
    """One team's score (#1384): the sum of its members' scores times the team's bonus multiplier, and what the sum
    adds up from.
    """

    name: str
    account_ids: list[int] = Field(
        description="The team's players, in the order they joined. A member who never entered has no player, so is left out"
    )
    operating_profit: float
    investments: float
    carbon_tax: float
    residual_value: float
    bonus_multiplier: float = Field(
        description="What the facilitator multiplies the team's score by, such as a quiz bonus. 1 when none is set"
    )
    score: float = Field(description="The sum of the members' scores, times the bonus multiplier")


class Scoreboard(BaseModel):
    """Every player's score after the Rounds completed so far, highest first, and every team's in a Run with teams."""

    completed_rounds: int = Field(ge=0, description="How many Rounds the scores count")
    final: bool = Field(description="Whether the session is over, so the scores are final")
    scores: list[Score]
    teams: list[TeamScore] | None = Field(description="Every team's score, highest first, or None without teams")


def ranked(players: Iterable[WorkshopPlayer], *, completed_rounds: int, price_round_count: int) -> list[Score]:
    """Every player's score once ``completed_rounds`` Rounds are completed, in a session priced for
    ``price_round_count`` Rounds, highest first. Players on the same score keep the order they joined in.
    """
    scores = [
        score(player, completed_rounds=completed_rounds, price_round_count=price_round_count) for player in players
    ]
    return sorted(scores, key=lambda player_score: player_score.score, reverse=True)


def ranked_teams(
    teams: Iterable[Team], scores: Iterable[Score], bonus_multipliers: Mapping[str, float]
) -> list[TeamScore]:
    """Every team's score from its players' ``scores``, highest first (#1384). A member who never entered adds
    nothing. Each team's score is multiplied by its multiplier in ``bonus_multipliers``, by team name, or by 1 if it
    has none. Teams on the same score keep their order in ``teams``.
    """
    scores = list(scores)
    team_scores = []
    for team in teams:
        members = [member for member in scores if member.team == team.name]
        sums = {part: sum(getattr(member, part) for member in members) for part in PARTS}
        multiplier = bonus_multipliers.get(team.name, 1.0)
        team_scores.append(
            TeamScore(
                name=team.name,
                account_ids=[member.account_id for member in members],
                bonus_multiplier=multiplier,
                score=sum(member.score for member in members) * multiplier,
                **sums,
            )
        )
    return sorted(team_scores, key=lambda team_score: team_score.score, reverse=True)
