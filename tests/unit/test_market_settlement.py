"""Characterization of how ``market_logic`` settles a clearing onto players.

These pin the persistent world's money, generation, dumping and demand-curtailment results for two
small markets, using real ``Player`` objects. They exist so the settlement arithmetic can move into
``energetica.sim`` (#1097) without changing what a player is paid, charged or curtailed.
"""

from __future__ import annotations

import pytest

from energetica import create_app
from energetica.accounts import Account
from energetica.database.map.hex_tile import HexTile
from energetica.database.player import Player
from energetica.production_update import market_logic
from energetica.sim.market import init_market, place_ask, place_bid
from energetica.utils.map_helpers import confirm_location

MUST_RUN_PRICE = -5


@pytest.fixture
def players() -> tuple[Player, Player]:
    """Two players settled on a fresh engine + map."""
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    accounts = [Account(account_id=i, username=f"p{i}", pwhash="pwhash", email=None, created_at="") for i in (1, 2)]
    a = confirm_location(accounts[0], HexTile.getitem(1))
    b = confirm_location(accounts[1], HexTile.getitem(40))
    return a, b


def _new_values(*players: Player) -> dict:
    """Fresh per-tick values. A new player has no facilities, so add the keys these markets touch."""
    values = {p.id: p.rolling_history.init_new_data() for p in players}
    for nv in values.values():
        for facility in ("steam_engine", "coal_burner", "gas_burner"):
            nv["generation"].setdefault(facility, 0.0)
        for key in ("exports", "dumping", "construction", "industry"):
            nv["demand"].setdefault(key, 0.0)
        for key in ("exports", "imports", "dumping", "industry"):
            nv["revenues"].setdefault(key, 0.0)
        nv["generation"].setdefault("imports", 0.0)
    return values


def _settle(players: tuple[Player, Player], market: dict, new_values: dict) -> dict:
    """Run ``market_logic`` and return the non-zero results that settlement is responsible for."""
    before = {p.id: p.money for p in players}
    market_logic(new_values, market)
    result: dict = {
        "price": market["market_price"],
        "quantity": market["market_quantity"],
        "player_exports": market["player_exports"],
        "player_imports": market["player_imports"],
        "generation_data": market["generation"],
        "consumption_data": market["consumption"],
        "generation_data_order": list(market["generation"]),
        "consumption_data_order": list(market["consumption"]),
    }
    for p in players:
        nv = new_values[p.id]
        result[p.id] = {
            # ``money`` is a large float that carries rounding noise near 1e-9; the revenues below pin the exact arithmetic.
            "money": round(p.money - before[p.id], 9),
            **{
                category: {k: v for k, v in nv[category].items() if v}
                for category in ("revenues", "generation", "demand")
            },
        }
    return result


def test_curtailed_demand_and_marginal_offer(players: tuple[Player, Player]) -> None:
    """A partly cleared marginal offer and a bid priced below the market are settled as before."""
    a, b = players
    new_values = _new_values(a, b)
    new_values[a.id]["demand"]["construction"] = 40.0
    new_values[b.id]["demand"]["industry"] = 120.0
    new_values[b.id]["revenues"]["industry"] = 10.0

    market = init_market()
    place_ask(market, a.id, 60, MUST_RUN_PRICE, "steam_engine")
    place_ask(market, a.id, 100, 30, "coal_burner")
    place_ask(market, b.id, 80, 50, "gas_burner")
    place_bid(market, b.id, 120, 100, "industry")
    place_bid(market, a.id, 40, 10, "construction")

    result = _settle(players, market, new_values)

    assert result == EXPECTED_CURTAILED


def test_unsold_must_run_power_is_dumped_and_paid_for(players: tuple[Player, Player]) -> None:
    """Must-run power that finds no buyer is dumped at the price floor and costs its owner money."""
    a, b = players
    new_values = _new_values(a, b)
    new_values[b.id]["demand"]["industry"] = 30.0
    new_values[b.id]["revenues"]["industry"] = 10.0

    market = init_market()
    place_ask(market, a.id, 60, MUST_RUN_PRICE, "steam_engine")
    place_bid(market, b.id, 30, 100, "industry")

    result = _settle(players, market, new_values)

    assert result == EXPECTED_DUMPING


# Player ids are 1 and 2 because each test builds a fresh engine. The clearing is at 30 with 120 MW cleared:
# player 1's must-run 60 MW and 60 of its 100 MW coal offer sell, player 2 buys all 120 MW, and player 1's
# 40 MW construction bid (priced below the market) is curtailed to zero, which is why it is absent below.
EXPECTED_CURTAILED: dict = {
    "price": 30,
    "quantity": 120.0,
    "player_exports": {1: 120.0},
    "player_imports": {2: 120},
    "generation_data": {"steam_engine": 60, "coal_burner": 60.0},
    "consumption_data": {"industry": 120},
    "generation_data_order": ["steam_engine", "coal_burner"],
    "consumption_data_order": ["industry"],
    1: {
        "money": 0.00024,
        "revenues": {"exports": 0.00024},
        "generation": {"coal_burner": 60.0},
        "demand": {"exports": 120.0},
    },
    2: {
        "money": -0.00024,
        "revenues": {"industry": 10.0, "imports": -0.00024},
        "generation": {"imports": 120.0},
        "demand": {"industry": 120.0},
    },
}

# Only 30 MW is bid, so the clearing is at the price floor with 30 MW cleared. The other 30 MW of player 1's
# must-run power is dumped and billed at the floor price on top of the (negative) sale revenue.
EXPECTED_DUMPING: dict = {
    "price": -5,
    "quantity": 30.0,
    "player_exports": {1: 60.0},
    "player_imports": {1: 30.0, 2: 30},
    "generation_data": {"steam_engine": 60.0},
    "consumption_data": {"dumping": 30.0, "industry": 30},
    "generation_data_order": ["steam_engine"],
    "consumption_data_order": ["dumping", "industry"],
    1: {
        "money": -2e-05,
        "revenues": {"exports": -1e-05, "dumping": -1e-05},
        "generation": {},
        "demand": {"exports": 30.0, "dumping": 30.0},
    },
    2: {
        "money": 1e-05,
        "revenues": {"industry": 10.0, "imports": 1e-05},
        "generation": {"imports": 30.0},
        "demand": {"industry": 30.0},
    },
}
