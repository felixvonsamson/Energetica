"""Turning a market clearing into money: the rules every mode of play settles the same way.

Pure and player-agnostic, like :mod:`~energetica.sim.market`. Given a :class:`MarketClearing` and the
length of a tick, :func:`settle_clearing` says what each offer sold, what each demand bought, and what
must-run power was dumped, along with the money involved. *Applying* that to a player's balance, to the
facility generation records, or to chart data is the caller's job, because those live in each mode's own
state.

The caller chooses the length of a tick. Scaling a representative day up to a season is also the caller's
job; nothing here knows about it.
"""

from __future__ import annotations

from dataclasses import dataclass

from energetica.sim.market import MIN_PRICE, MarketClearing

#: Below this many MW a partly cleared entry is treated as not having traded at all.
MIN_SETTLED_QUANTITY = 0.1


def energy_value(quantity: float, price: float, seconds_per_tick: float) -> float:
    """Return the money for ``quantity`` MW at ``price`` (per MWh) sustained for one tick, in millions."""
    return quantity * price / 3600 * seconds_per_tick / 1_000_000


@dataclass(frozen=True, slots=True)
class SaleSettlement:
    """What one supply offer sold, and what was dumped if it was must-run power that did not clear."""

    player_id: int
    facility: str
    quantity: float  # MW sold at the market price; 0 when nothing traded
    revenue: float  # money earned for ``quantity``; negative when the market price is negative
    counts_as_generation: bool  # False for must-run offers, whose output the caller already recorded
    dumped: float | None = None  # MW of must-run power thrown away; None when the offer was not must-run
    dump_cost: float = 0.0  # money owed for ``dumped``


@dataclass(frozen=True, slots=True)
class PurchaseSettlement:
    """What one demand bid bought, and how much of it was left unserved."""

    player_id: int
    facility: str
    quantity: float  # MW bought at the market price; 0 when nothing traded
    cost: float  # money owed for ``quantity``; negative when the market price is negative
    served: float | None  # MW the bid received when it was not fully served; None when it was fully served


@dataclass(frozen=True, slots=True)
class Settlement:
    """Every trade and dump of one clearing, in the order the caller should apply them."""

    sales: list[SaleSettlement]
    purchases: list[PurchaseSettlement]


def settle_clearing(clearing: MarketClearing, seconds_per_tick: float) -> Settlement:
    """Work out what each entry of ``clearing`` sold or bought, and what it costs or earns.

    Offers arrive in merit order. Offers that cleared in full sell their whole capacity. The first offer
    that did not clear in full sells what it can, and nothing after it sells, except that must-run offers
    (priced at :data:`MIN_PRICE`, which sort first) that did not clear dump the power they could not sell.
    Every demand that did not clear in full reports how much of it was served, so the caller can curtail it.
    """
    price = clearing.price
    quantity = clearing.quantity

    sales: list[SaleSettlement] = []
    for fill in clearing.offers:
        entry = fill.entry
        counts_as_generation = entry.price > MIN_PRICE
        if entry.cumul_capacities <= quantity:
            sales.append(
                SaleSettlement(
                    entry.player_id,
                    entry.facility,
                    entry.capacity,
                    energy_value(entry.capacity, price, seconds_per_tick),
                    counts_as_generation,
                )
            )
            continue
        sold = fill.cleared
        traded = sold if sold > MIN_SETTLED_QUANTITY else 0.0
        revenue = energy_value(traded, price, seconds_per_tick)
        if entry.price <= MIN_PRICE:
            dumped = max(0.0, min(entry.capacity, entry.capacity - sold))
            dump_cost = energy_value(dumped, -MIN_PRICE, seconds_per_tick)
            sales.append(
                SaleSettlement(
                    entry.player_id, entry.facility, traded, revenue, counts_as_generation, dumped, dump_cost
                )
            )
            continue
        sales.append(SaleSettlement(entry.player_id, entry.facility, traded, revenue, counts_as_generation))
        break

    purchases: list[PurchaseSettlement] = []
    for fill in clearing.demands:
        entry = fill.entry
        if entry.cumul_capacities > quantity:
            bought = fill.cleared
            traded = bought if bought > MIN_SETTLED_QUANTITY else 0.0
            cost = energy_value(traded, price, seconds_per_tick)
            purchases.append(PurchaseSettlement(entry.player_id, entry.facility, traded, cost, max(0.0, bought)))
        else:
            cost = energy_value(entry.capacity, price, seconds_per_tick)
            purchases.append(PurchaseSettlement(entry.player_id, entry.facility, entry.capacity, cost, None))

    return Settlement(sales, purchases)
