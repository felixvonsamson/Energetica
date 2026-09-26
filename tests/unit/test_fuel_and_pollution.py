"""Characterization of the fuel a generating facility burns and the pollution it emits per tick (#1100).

Both scale linearly with how much of its power the facility actually produced. These tests pin that with a
real player, and work the expected values out from the player's own capacities so a rebalance of facility
figures does not break them.
"""

from __future__ import annotations

import pytest

from energetica import create_app
from energetica.accounts import Account
from energetica.database.map.hex_tile import HexTile
from energetica.database.player import Player
from energetica.enums import ControllableFacilityType, Fuel
from energetica.init_test_players import add_asset
from energetica.production_update import resources_and_pollution
from energetica.utils.map_helpers import confirm_location

COAL = ControllableFacilityType.COAL_BURNER
NUCLEAR = ControllableFacilityType.NUCLEAR_REACTOR
STOCK = 1000.0


@pytest.fixture
def player() -> Player:
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")
    account = Account(account_id=1, username="fuel", pwhash="pwhash", email=None, created_at="")
    p = confirm_location(account, HexTile.getitem(1))
    for facility in (COAL, NUCLEAR):
        add_asset(p, facility, 1)
    for fuel in Fuel:
        p.resources[fuel] = STOCK
    return p


def _run(p: Player, coal_share: float, nuclear_share: float) -> tuple[dict, dict[Fuel, float]]:
    """Run one tick of ``resources_and_pollution`` and return the new values and the fuel burned."""
    new_values = p.rolling_history.init_new_data()
    new_values["generation"][COAL] = p.capacities[COAL]["power"] * coal_share
    new_values["generation"][NUCLEAR] = p.capacities[NUCLEAR]["power"] * nuclear_share
    before = dict(p.resources)

    resources_and_pollution(new_values, p)

    burned = {fuel: before[fuel] - p.resources[fuel] for fuel in Fuel}
    return new_values, burned


def test_fuel_burned_is_the_full_power_burn_scaled_by_the_share_of_power_produced(player: Player) -> None:
    _, burned = _run(player, coal_share=0.25, nuclear_share=0.5)

    assert burned[Fuel.COAL] == pytest.approx(player.capacities[COAL]["fuel_use"][Fuel.COAL] * 0.25)
    assert burned[Fuel.URANIUM] == pytest.approx(player.capacities[NUCLEAR]["fuel_use"][Fuel.URANIUM] * 0.5)
    assert burned[Fuel.GAS] == 0


def test_emissions_are_the_full_power_pollution_scaled_by_the_share_of_power_produced(player: Player) -> None:
    new_values, _ = _run(player, coal_share=0.25, nuclear_share=0.5)

    assert new_values["emissions"][COAL] == pytest.approx(player.capacities[COAL]["pollution"] * 0.25)
    assert new_values["emissions"][NUCLEAR] == pytest.approx(player.capacities[NUCLEAR]["pollution"] * 0.5)


def test_emissions_are_added_to_the_players_running_total(player: Player) -> None:
    _run(player, coal_share=0.5, nuclear_share=0.0)

    assert player.cumul_emissions.get_all()[COAL] == pytest.approx(player.capacities[COAL]["pollution"] * 0.5)


def test_an_idle_facility_burns_nothing_and_emits_nothing(player: Player) -> None:
    new_values, burned = _run(player, coal_share=0.0, nuclear_share=0.0)

    assert all(amount == 0 for amount in burned.values())
    assert new_values["emissions"][COAL] == 0
    assert new_values["emissions"][NUCLEAR] == 0
