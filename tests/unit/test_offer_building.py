"""Characterization of how a player's facilities are offered on the market (#1098).

A facility offers the output it cannot hold back at the price floor (``MIN_PRICE``), so it always sits
first in the merit order, and the output above that up to its maximum at the price the player asked. The
same rule builds a player's offers whether or not the player is in a network. These tests pin both paths
with a real player so the rule can move into ``energetica.sim`` without changing what gets offered.
"""

from __future__ import annotations

import pytest

import energetica.production_update as production_update
from energetica import create_app
from energetica.accounts import Account
from energetica.database.map.hex_tile import HexTile
from energetica.database.player import Player
from energetica.enums import ControllableFacilityType, Fuel, StorageFacilityType
from energetica.init_test_players import add_asset
from energetica.production_update import calculate_generation_with_market, calculate_generation_without_market
from energetica.sim.market import MIN_PRICE, init_market
from energetica.utils.map_helpers import confirm_location

STEAM = ControllableFacilityType.STEAM_ENGINE
COAL = ControllableFacilityType.COAL_BURNER
BATTERY = StorageFacilityType.LITHIUM_ION_BATTERIES


@pytest.fixture
def player() -> Player:
    """A player with two controllable facilities and a battery, all running above their ramp-down limit.

    Previous output is set high enough that each controllable facility cannot ramp fully down in one tick,
    so it has a non-zero must-run output as well as headroom.
    """
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")
    account = Account(account_id=1, username="offers", pwhash="pwhash", email=None, created_at="")
    p = confirm_location(account, HexTile.getitem(1))
    for facility in (COAL, STEAM, BATTERY):
        add_asset(p, facility, 1)
    p.resources[Fuel.COAL] = 1e6
    for facility, output in ((COAL, 2_000_000.0), (STEAM, 1_000_000.0), (BATTERY, 5_000_000.0)):
        p.rolling_history._data["generation"][facility][-1] = output
    p.rolling_history._data["storage"][BATTERY][-1] = 1e6
    p.network_prices.ask_prices[STEAM] = 40.0
    p.network_prices.ask_prices[COAL] = 60.0
    p.network_prices.ask_prices[BATTERY] = 90.0
    return p


def _new_values(p: Player) -> dict:
    return {p.id: p.rolling_history.init_new_data()}


def _summary(entries: list) -> list[tuple[str, float]]:
    return [(str(e.facility), e.price) for e in entries]


def test_networked_player_offers_must_run_output_first_then_headroom_at_the_asked_price(player: Player) -> None:
    market = calculate_generation_with_market(_new_values(player), init_market(), player)

    assert _summary(market["capacities"]) == [
        (STEAM, MIN_PRICE),
        (COAL, MIN_PRICE),
        (STEAM, 40.0),
        (COAL, 60.0),
        (BATTERY, 90.0),
    ]
    assert all(entry.capacity > 0 for entry in market["capacities"])
    assert {entry.player_id for entry in market["capacities"]} == {player.id}


def test_networked_player_bids_its_demand_at_the_set_prices(player: Player) -> None:
    new_values = _new_values(player)
    new_values[player.id]["demand"]["industry"] = 1000.0
    new_values[player.id]["demand"]["construction"] = 200.0
    player.network_prices.bid_prices["industry"] = 100.0
    player.network_prices.bid_prices["construction"] = 110.0

    market = calculate_generation_with_market(new_values, init_market(), player)

    assert [(str(e.facility), e.capacity, e.price) for e in market["demands"]] == [
        ("industry", 1000.0, 100.0),
        ("construction", 200.0, 110.0),
    ]


def test_player_without_a_network_offers_the_same_output_on_its_internal_market(
    player: Player, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: dict = {}
    real_market_logic = production_update.market_logic

    def spy(new_values: dict, market: dict) -> None:
        captured["market"] = market
        real_market_logic(new_values, market)

    monkeypatch.setattr(production_update, "market_logic", spy)
    networked = calculate_generation_with_market(_new_values(player), init_market(), player)["capacities"]

    calculate_generation_without_market(_new_values(player), player)

    internal = captured["market"]["capacities"]
    assert _summary(internal) == _summary(networked)
    assert [e.capacity for e in internal] == pytest.approx([e.capacity for e in networked])
