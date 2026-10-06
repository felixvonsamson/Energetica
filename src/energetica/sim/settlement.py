"""Turning a market clearing into money: the rules every mode of play settles the same way.

Pure and player-agnostic, like :mod:`~energetica.sim.market`. Given a :class:`MarketClearing`, the
length of a tick and the cost of dumping power, :func:`settle_clearing` says what each offer sold and
produced, what each demand bought, and what must-run power was dumped, along with the money involved.
*Applying* that to a player's balance, to the facility generation records, or to chart data is the
caller's job, because those live in each mode's own state.

The caller chooses the length of a tick and the dump cost, since each mode of play has its own. Scaling
a representative day up to a season is also the caller's job; nothing here knows about it.
"""

from __future__ import annotations

from dataclasses import dataclass

from energetica.sim.market import MarketClearing

#: Below this many W a partly cleared entry is treated as not having traded at all.
MIN_SETTLED_QUANTITY = 0.1


def energy_value(quantity: float, price: float, seconds_per_tick: float) -> float:
    """Return the money for ``quantity`` W at ``price`` (per MWh) sustained for one tick.

    Quantities are in watts and prices are per megawatt hour, so dividing by a million converts the
    quantity to megawatts before it meets the price. The result is in whole currency units.
    """
    return quantity * price / 3600 * seconds_per_tick / 1_000_000


@dataclass(frozen=True, slots=True)
class SaleSettlement:
    """What one supply offer sold, and what was dumped if it was must-run power that did not clear."""

    player_id: int
    facility: str
    quantity: float  # W sold at the market price; 0 when nothing traded
    revenue: float  # money earned for ``quantity``; negative when the market price is negative
    produced: float  # W the facility generated for this offer: what sold, plus what was dumped
    # W of must-run power thrown away. None unless the offer was must-run and did not sell in full.
    dumped: float | None = None
    dump_cost: float = 0.0  # money owed for ``dumped``


@dataclass(frozen=True, slots=True)
class PurchaseSettlement:
    """What one demand bid bought, and how much of it was left unserved."""

    player_id: int
    facility: str
    quantity: float  # W bought at the market price; 0 when nothing traded
    cost: float  # money owed for ``quantity``; negative when the market price is negative
    served: float | None  # W the bid received when it was not fully served; None when it was fully served


@dataclass(frozen=True, slots=True)
class Settlement:
    """Every trade and dump of one clearing, in the order the caller should apply them."""

    sales: list[SaleSettlement]
    purchases: list[PurchaseSettlement]


def settle_clearing(clearing: MarketClearing, seconds_per_tick: float, dump_cost_per_mwh: float) -> Settlement:
    """Work out what each entry of ``clearing`` sold or bought, and what it costs or earns.

    Offers arrive in merit order. Offers that cleared in full sell their whole capacity. The first offer
    that did not clear in full (the marginal offer) sells what it can, and nothing after it sells. Must-run
    offers (:attr:`MarketEntry.must_run`) can sit anywhere in the merit order: the power they do not sell
    is dumped, at ``dump_cost_per_mwh``, wherever they sit.
    Every demand that did not clear in full reports how much of it was served, so the caller can curtail it.
    """
    price = clearing.price
    quantity = clearing.quantity

    sales: list[SaleSettlement] = []
    past_marginal_offer = False
    for fill in clearing.offers:
        entry = fill.entry
        if entry.cumul_capacities <= quantity:
            sales.append(
                SaleSettlement(
                    entry.player_id,
                    entry.facility,
                    entry.capacity,
                    energy_value(entry.capacity, price, seconds_per_tick),
                    entry.capacity,
                )
            )
            continue
        sold = fill.cleared
        traded = sold if sold > MIN_SETTLED_QUANTITY else 0.0
        revenue = energy_value(traded, price, seconds_per_tick)
        if entry.must_run:
            dumped = entry.capacity - traded
            dump_cost = energy_value(dumped, dump_cost_per_mwh, seconds_per_tick)
            sales.append(
                SaleSettlement(entry.player_id, entry.facility, traded, revenue, entry.capacity, dumped, dump_cost)
            )
        elif not past_marginal_offer:
            sales.append(SaleSettlement(entry.player_id, entry.facility, traded, revenue, traded))
        past_marginal_offer = True

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
