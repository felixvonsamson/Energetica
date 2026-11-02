"""The carbon tax (#1015): once players vote it in (:mod:`~energetica.workshop.votes`), it is settled in every Trading
period from that Round on, alongside the period's revenue and costs.

Each player settled in the period pays :data:`~energetica.workshop.votes.CARBON_TAX_RATE` on each kg of CO₂ their
facilities emitted generating in it. Building a facility emits nothing in the workshop (#1414), so it is never taxed.
Everything the players pay makes up the period's takings, which are shared out equally among the players settled in
the period. So a player who emitted less than average gets
back more than they paid.

The tax is not part of the operating profit (:mod:`~energetica.workshop.operating_profit`): neither what a player pays
nor what they get back counts toward it.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

from energetica.workshop.seasons import Season
from energetica.workshop.trading import TradingResult
from energetica.workshop.votes import CARBON_TAX_RATE, VoteOutcome, carbon_tax_since


def carbon_tax_rate(outcomes: Iterable[VoteOutcome], round_number: int) -> float:
    """What the carbon tax charges per kg of CO₂ in Round ``round_number``, or zero if it is not in force."""
    since = carbon_tax_since(outcomes)
    return CARBON_TAX_RATE if since is not None and since <= round_number else 0.0


def settle_carbon_tax(
    results: Mapping[int, TradingResult | None],
    *,
    rate: float,
    round_number: int,
    season: Season,
) -> dict[int, TradingResult]:
    """Settle the carbon tax of one Trading period, and return each player's result with it, by player id.

    ``results`` has an entry for every player settled in the period. It is None for a player who had nothing
    operating.

    A player who had nothing operating still gets their share of the takings. To hold it, they get a result with no
    facilities. When there is nothing to share, because the tax is not in force or nobody emitted anything, they get
    no result and are left out of the returned dict.
    """
    present = {player: result for player, result in results.items() if result is not None}
    if rate == 0 or not results:
        return present
    taxed = {
        player: (
            result if result is not None else TradingResult(round=round_number, season=season, facilities={})
        ).model_copy(update={"carbon_tax_rate": rate})
        for player, result in results.items()
    }
    takings = sum(result.carbon_tax_paid for result in taxed.values())
    if takings == 0:
        return {player: result for player, result in taxed.items() if player in present}
    share = takings / len(taxed)
    return {player: result.model_copy(update={"carbon_tax_share": share}) for player, result in taxed.items()}
