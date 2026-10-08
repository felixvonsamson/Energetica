"""A player's operating profit: the first term of the final score, and what the Round overview shows (#1006).

Operating profit is all of a player's trading income minus their operating costs: O&M, the energy storage
bought to charge, and the renewable output dumped unsold. Facility investments, the carbon tax, the floor
top-up and blackout resets are left out, so the figure shows how well a player ran their fleet, untouched
by changes to their cash that are not theirs to make (#992 §8).

The per-Round subtotal and the session total are both added up from the same per-period figures, so they
always agree. Both read only the Trading-period results the session already keeps for each player.

Two parts are still to come. Fuel will count when it is bought (#1009), since fuel prices change over time
and the purchase is the only point where its real cost is known, so a Round's purchases will join that
Round's subtotal. A climate event's ``revenue_tax`` (#1012) will come off the income of the period it hits.
"""

from __future__ import annotations

from collections.abc import Iterable

from energetica.workshop.trading import TradingResult


def period_operating_profit(result: TradingResult) -> float:
    """The operating profit of one Trading period: what its facility types earned, less what they cost to run."""
    return sum(performance.net for performance in result.facilities.values())


def round_operating_profit(results: Iterable[TradingResult], round_number: int) -> float:
    """The operating profit of Round ``round_number``, over those of its Trading periods in ``results``."""
    return sum(period_operating_profit(result) for result in results if result.round == round_number)


def session_operating_profit(results: Iterable[TradingResult]) -> float:
    """The operating profit of every Trading period in ``results``: the whole session so far."""
    return sum(period_operating_profit(result) for result in results)
