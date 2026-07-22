"""Tests for the player's CO2 emission summaries used by the recap (ADR-0005).

``calculate_produced_co2`` (gross, positive categories) and ``calculate_net_emissions`` (all
categories) both read ``cumul_emissions``, where emitting facilities record positive values and
capture records a negative one (``production_update`` adds ``-captured_co2`` under ``carbon_capture``).
The recap shows produced and captured un-netted, so gross-produced must exclude the capture sink.
"""

from __future__ import annotations

import pytest

from energetica import create_app
from energetica.database.map.hex_tile import HexTile
from energetica.database.player import Player
from energetica.database.user import User
from energetica.utils.map_helpers import confirm_location


@pytest.fixture
def player() -> Player:
    """A fresh player settled on a fresh engine + map (Player construction needs both)."""
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    user = User("emitter", "pwhash", role="player", account_id=1)
    return confirm_location(user, HexTile.getitem(1))


def test_produced_co2_sums_only_positive_categories(player: Player) -> None:
    """Gross produced is the emitting facilities; the negative capture category is excluded."""
    player.cumul_emissions.add("steam_engine", 300.0)
    player.cumul_emissions.add("construction", 50.0)
    player.cumul_emissions.add_category("carbon_capture")
    player.cumul_emissions.add("carbon_capture", -120.0)  # capture is stored negative

    assert player.calculate_produced_co2() == 350.0  # 300 + 50, capture excluded


def test_net_emissions_sums_all_categories(player: Player) -> None:
    """Net still nets the capture back out — the collapsed figure the recap shows alongside."""
    player.cumul_emissions.add("steam_engine", 300.0)
    player.cumul_emissions.add("construction", 50.0)
    player.cumul_emissions.add_category("carbon_capture")
    player.cumul_emissions.add("carbon_capture", -120.0)

    assert player.calculate_net_emissions() == 230.0  # 300 + 50 - 120


def test_produced_co2_is_zero_with_no_emissions(player: Player) -> None:
    assert player.calculate_produced_co2() == 0.0
