"""Unit tests for the extracted uniform-price market clearing (issue #873, S1).

The point of the extraction is that ``clear_market`` is *pure and player-agnostic*:
it finds the price/quantity and per-entry cleared MW without ever reading
``MarketEntry.player_id`` — so it can be exercised here with no ``Player``, no DB,
and no engine, and a future caller can inject a demand bid backed by no player at all.
"""

from __future__ import annotations

from energetica.market import MarketEntry, clear_market, market_optimum, place_ask, place_bid


def _offer(capacity: float, price: float, player_id: int = 0) -> MarketEntry:
    return MarketEntry(player_id, capacity, price, "facility")


def _demand(capacity: float, price: float, player_id: int = 0) -> MarketEntry:
    return MarketEntry(player_id, capacity, price, "demand")


def test_clears_without_any_player() -> None:
    """The whole seam: clear a market whose entries reference no real player.

    ``player_id`` here is a sentinel that ``Player.get`` would fail on — the fact
    that clearing returns cleanly proves it never touches the player layer.
    """
    offers = [_offer(100, 10, player_id=-1), _offer(100, 50, player_id=-1)]
    demands = [_demand(150, 80, player_id=-999), _demand(100, 30, player_id=-999)]

    clearing = clear_market(offers, demands)

    assert clearing.price == 50
    assert clearing.quantity == 150


def test_marginal_offer_is_partially_cleared() -> None:
    """The price-setting offer clears only up to the intersection quantity."""
    offers = [_offer(100, 10), _offer(100, 50)]
    demands = [_demand(150, 80), _demand(100, 30)]

    clearing = clear_market(offers, demands)

    # offers come back sorted ascending by price
    cheap, marginal = clearing.offers
    assert cheap.entry.price == 10
    assert cheap.cleared == 100  # fully in-merit
    assert marginal.entry.price == 50
    assert marginal.cleared == 50  # 100 - cumul(200) + quantity(150)
    assert sum(f.cleared for f in clearing.offers) == clearing.quantity


def test_unserved_is_all_demand_that_did_not_clear() -> None:
    """Unserved = total demand bid minus demand cleared — the quantity today's
    ``reduce_demand`` consumes silently, now reported additively.
    """
    offers = [_offer(100, 10), _offer(100, 50)]
    demands = [_demand(150, 80), _demand(100, 30)]

    clearing = clear_market(offers, demands)

    total_demand = 150 + 100
    assert clearing.unserved == total_demand - clearing.quantity
    assert clearing.unserved == 100
    # demands come back sorted descending by price: the €80 bid is served, the €30 bid is not
    served, curtailed = clearing.demands
    assert served.entry.price == 80
    assert served.unmet == 0
    assert curtailed.entry.price == 30
    assert curtailed.unmet == 100


def test_cleared_is_clamped_to_capacity_beyond_the_margin() -> None:
    """Offers past the marginal one clear nothing — never a negative fill."""
    offers = [_offer(50, 10), _offer(50, 20), _offer(50, 90)]
    demands = [_demand(60, 100)]

    clearing = clear_market(offers, demands)

    assert clearing.quantity == 60
    assert all(0.0 <= f.cleared <= f.entry.capacity for f in clearing.offers)
    # third offer (price 90) sits entirely past the intersection
    assert clearing.offers[2].entry.price == 90
    assert clearing.offers[2].cleared == 0.0


def test_empty_market_clears_to_zero() -> None:
    clearing = clear_market([], [])
    assert clearing.price == 0
    assert clearing.quantity == 0
    assert clearing.offers == []
    assert clearing.demands == []
    assert clearing.unserved == 0


def test_no_cross_serves_nothing() -> None:
    """When the cheapest offer is dearer than the priciest bid, nothing clears and
    all demand is unserved.
    """
    offers = [_offer(100, 90)]
    demands = [_demand(80, 40)]

    clearing = clear_market(offers, demands)

    assert clearing.quantity == 0
    assert clearing.offers[0].cleared == 0.0
    assert clearing.unserved == 80


def test_place_helpers_skip_nonpositive_quantities() -> None:
    """place_ask/place_bid append only positive-quantity entries."""
    market = {"capacities": [], "demands": []}
    place_ask(market, 1, 50, 10, "coal")
    place_ask(market, 1, 0, 10, "coal")  # skipped
    place_bid(market, 2, 30, 80, "industry")
    place_bid(market, 2, -5, 80, "industry")  # skipped

    assert len(market["capacities"]) == 1
    assert len(market["demands"]) == 1


def test_market_optimum_matches_clear_market_price_quantity() -> None:
    """clear_market delegates price/quantity to market_optimum unchanged."""
    offers = [_offer(100, 10), _offer(100, 50)]
    demands = [_demand(150, 80), _demand(100, 30)]
    clearing = clear_market(offers, demands)

    # market_optimum needs cumul_capacities populated, which clear_market has now done
    assert market_optimum([f.entry for f in clearing.offers], [f.entry for f in clearing.demands]) == (
        clearing.price,
        clearing.quantity,
    )
