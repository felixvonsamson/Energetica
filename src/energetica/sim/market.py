"""Electricity market construction and uniform-price clearing.

Pure and player-agnostic: nothing in this module reads ``Player``, engine state,
``new_values``, or touches I/O. Given supply offers and demand bids it finds the
uniform clearing price and quantity and reports, per entry, how much cleared —
plus the market-level unserved demand. *Settlement* (money, generation,
curtailment, chart data) is the caller's job and lives in ``production_update``.

Because clearing never reads ``MarketEntry.player_id``, a caller can inject a
demand bid backed by no player at all (e.g. a Workshop-mode demand block) and
still get a well-defined clearing out.

Naming follows finance convention: :func:`place_ask` adds *supply* (a seller's
offer, into ``capacities``); :func:`place_bid` adds *demand* (a buyer's bid, into
``demands``). A facility's supply is offered in two parts, :func:`place_must_run_ask` for the
output it cannot hold back and :func:`place_headroom_ask` for the rest, so the rule for splitting
it is the same in every mode.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


#: The lowest price an offer can carry. Generation that must run regardless of price (renewables, the
#: minimum output a controllable facility cannot ramp below) is offered here so it always sits first in
#: the merit order. Unsold power at this price is dumped, and the owner pays this price per MWh to do so.
MIN_PRICE = -5


class MarketEntry:
    __slots__ = ("player_id", "capacity", "price", "facility", "cumul_capacities")

    def __init__(self, player_id: int, capacity: float, price: float, facility: str) -> None:
        self.player_id = player_id
        self.capacity = capacity
        self.price = price
        self.facility = facility
        self.cumul_capacities = 0.0


def init_market() -> dict:
    """Initialize an empty market."""
    return {
        "capacities": [],
        "demands": [],
    }


def place_ask(market: dict, player_id: int, capacity: float, price: float, facility: str) -> dict:
    """Make an ask (offer, supply) on the market."""
    if capacity > 0:
        market["capacities"].append(MarketEntry(player_id, capacity, price, facility))
    return market


def place_bid(market: dict, player_id: int, demand: float, price: float, facility: str) -> dict:
    """Make a bid (demand) on the market."""
    if demand > 0:
        market["demands"].append(MarketEntry(player_id, demand, price, facility))
    return market


def place_must_run_ask(market: dict, player_id: int, output: float, facility: str) -> dict:
    """Offer output that cannot be held back at :data:`MIN_PRICE`, so it sits first in the merit order."""
    return place_ask(market, player_id, output, MIN_PRICE, facility)


def place_headroom_ask(
    market: dict, player_id: int, minimum: float, maximum: float, price: float, facility: str
) -> dict:
    """Offer the output a facility can add above its ``minimum``, up to its ``maximum``, at ``price``."""
    return place_ask(market, player_id, maximum - minimum, price, facility)


@dataclass(frozen=True, slots=True)
class Fill:
    """One market entry paired with how much of it cleared at the market price."""

    entry: MarketEntry
    cleared: float  # W sold (offer) or bought (demand), clamped to [0, entry.capacity]

    @classmethod
    def from_entry(cls, entry: MarketEntry, quantity: float) -> Fill:
        """Build the fill for ``entry`` given the market cleared ``quantity`` W.

        Entries whose cumulative capacity sits at or below ``quantity`` clear in full;
        the marginal (price-setting) entry clears partially; entries past it clear nothing.
        """
        if entry.cumul_capacities > quantity:
            cleared = max(0.0, min(entry.capacity, entry.capacity - entry.cumul_capacities + quantity))
        else:
            cleared = entry.capacity
        return cls(entry, cleared)

    @property
    def unmet(self) -> float:
        """W that was offered (supply) or bid (demand) but did not clear."""
        return self.entry.capacity - self.cleared


@dataclass(frozen=True, slots=True)
class MarketClearing:
    """Result of a uniform-price clearing. Pure data — carries no Player references."""

    price: float  # uniform clearing price
    quantity: float  # total cleared W at the supply/demand intersection
    offers: list[Fill]  # sorted ascending by price; each entry's cumul_capacities is set
    demands: list[Fill]  # sorted descending by price; each entry's cumul_capacities is set
    unserved: float  # market-level W of demand that was bid but did not clear (total demand - cleared demand)


def clear_market(offers: list[MarketEntry], demands: list[MarketEntry]) -> MarketClearing:
    """Clear a uniform-price market.

    Sorts offers ascending and demands descending by price, sets each entry's
    ``cumul_capacities``, finds the clearing price and quantity via
    :func:`market_optimum`, then reports per-entry cleared MW and the
    market-level unserved demand.

    Mutates the passed entries' ``cumul_capacities`` in place — the caller's
    chart serialization relies on the merit-order position being recorded there.
    """
    sorted_offers = sorted(offers, key=lambda e: e.price)
    cumul = 0.0
    for entry in sorted_offers:
        cumul += entry.capacity
        entry.cumul_capacities = cumul

    sorted_demands = sorted(demands, key=lambda e: e.price, reverse=True)
    cumul = 0.0
    for entry in sorted_demands:
        cumul += entry.capacity
        entry.cumul_capacities = cumul

    price, quantity = market_optimum(sorted_offers, sorted_demands)

    offer_fills = [Fill.from_entry(entry, quantity) for entry in sorted_offers]
    demand_fills = [Fill.from_entry(entry, quantity) for entry in sorted_demands]
    unserved = sum(fill.unmet for fill in demand_fills)

    return MarketClearing(price, quantity, offer_fills, demand_fills, unserved)


def market_optimum(offers: list[MarketEntry], demands: list[MarketEntry]) -> tuple[float, float]:
    """Find market price and quantity by finding the intersection of demand and supply."""
    if not demands or not offers:
        return 0, 0

    price_d = demands[0].price
    price_o = offers[0].price

    if price_o > price_d:
        return price_d, 0

    # Build merged event list: (cumul_capacity, is_offer, next_step_price)
    # For offers (sorted ascending): next step price is the price of the next row (or +inf for last)
    # For demands (sorted descending): next step price is the price of the next row (or negative infinity for
    # the last, a sentinel below every valid offer price so the final demand step always crosses supply)
    events: list[tuple[float, bool, float]] = []
    for i, entry in enumerate(offers):
        next_price = offers[i + 1].price if i + 1 < len(offers) else math.inf
        events.append((entry.cumul_capacities, True, next_price))
    for i, entry in enumerate(demands):
        next_price = demands[i + 1].price if i + 1 < len(demands) else -math.inf
        events.append((entry.cumul_capacities, False, next_price))

    events.sort(key=lambda e: e[0])

    for cumul, is_offer, next_price in events:
        if is_offer:
            price_o = next_price
        else:
            price_d = next_price
        if price_d < price_o:
            return (price_d if is_offer else price_o), cumul
    raise ValueError("No market optimum found.")
