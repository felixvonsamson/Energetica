"""The carbon tax (#1015): once players vote it in (:mod:`~energetica.workshop.votes`), it is settled in every Trading
period from that Round on, alongside the period's revenue and costs.

Each player settled in the period pays :data:`~energetica.workshop.votes.CARBON_TAX_RATE` on each kg of CO₂ their
facilities emitted generating in it. In a Round's first Trading period, they also pay on the CO₂ emitted building the
facilities they bought in the Round's Investment phase. Everything paid goes into one pool, which is shared out
equally among the players settled in the period, so a player who emitted less than average gets back more than they
paid.

The tax is not part of the operating profit (:mod:`~energetica.workshop.operating_profit`): neither what a player pays
nor what they get back counts toward it.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

from energetica.workshop.facilities import CATALOG
from energetica.workshop.fleet import Purchase
from energetica.workshop.seasons import Season
from energetica.workshop.trading import TradingResult
from energetica.workshop.votes import CARBON_TAX_RATE, VoteOutcome, carbon_tax_since


def carbon_tax_rate(outcomes: Iterable[VoteOutcome], round_number: int) -> float:
    """What the carbon tax charges per kg of CO₂ in Round ``round_number``, or zero if it is not in force."""
    since = carbon_tax_since(outcomes)
    return CARBON_TAX_RATE if since is not None and since <= round_number else 0.0


def construction_emissions(purchases: Iterable[Purchase], round_number: int) -> float:
    """The CO₂ emitted building the facilities in ``purchases`` bought in Round ``round_number``, in kg."""
    return sum(
        CATALOG[purchase.facility].base_construction_pollution
        for purchase in purchases
        if purchase.round == round_number
    )


def settle_carbon_tax(
    results: Mapping[int, TradingResult | None],
    construction: Mapping[int, float],
    *,
    rate: float,
    round_number: int,
    season: Season,
) -> dict[int, TradingResult]:
    """Each settled player's result for a Trading period with the carbon tax settled on it, by player id.

    ``results`` holds every player settled in the period, with None for one who had nothing operating, and
    ``construction`` the CO₂ each one is taxed on for building, in kg. At a ``rate`` of zero, the results come back as
    they are. Otherwise a player with nothing operating gets an empty result to hold their share, unless the pool is
    empty. A player left without a result is left out.
    """
    present = {player: result for player, result in results.items() if result is not None}
    if rate == 0 or not results:
        return present
    taxed = {
        player: (result or TradingResult(round=round_number, season=season, facilities={})).model_copy(
            update={"carbon_tax_rate": rate, "construction_emissions": construction.get(player, 0.0)}
        )
        for player, result in results.items()
    }
    pool = sum(result.construction_carbon_tax + result.emitted_carbon_tax for result in taxed.values())
    if pool == 0:
        return {player: result for player, result in taxed.items() if player in present}
    share = pool / len(taxed)
    return {player: result.model_copy(update={"carbon_tax_share": share}) for player, result in taxed.items()}
