"""Characterization of the operating (O&M) cost a player pays per tick (#1101).

Every facility has a maximum O&M cost per tick. Part of it is fixed and owed however little the facility
runs; the rest scales with how much it runs. The fixed share is 100% for renewable and storage facilities,
50% for nuclear reactors, and 20% for other controllable facilities and for extraction facilities. These
tests pin the persistent world's result with a real player, with expected values worked out from the
player's own capacities.
"""

from __future__ import annotations

import pytest

from energetica import create_app
from energetica.accounts import Account
from energetica.database.map.hex_tile import HexTile
from energetica.database.player import Player
from energetica.enums import (
    ControllableFacilityType,
    ExtractionFacilityType,
    StorageFacilityType,
    WindFacilityType,
)
from energetica.init_test_players import add_asset
from energetica.production_update import resources_and_pollution
from energetica.utils.map_helpers import confirm_location

WIND = WindFacilityType.ONSHORE_WIND_TURBINE
BATTERY = StorageFacilityType.LITHIUM_ION_BATTERIES
COAL = ControllableFacilityType.COAL_BURNER
NUCLEAR = ControllableFacilityType.NUCLEAR_REACTOR
MINE = ExtractionFacilityType.COAL_MINE


@pytest.fixture
def player() -> Player:
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")
    account = Account(account_id=1, username="ops", pwhash="pwhash", email=None, created_at="")
    p = confirm_location(account, HexTile.getitem(1))
    for facility in (WIND, BATTERY, COAL, NUCLEAR, MINE):
        add_asset(p, facility, 1)
    return p


def _run(p: Player, coal_share: float, nuclear_share: float, mine_share: float) -> dict:
    """Run one tick with the given utilisation and return the operating costs charged (as negative values)."""
    new_values = p.rolling_history.init_new_data()
    new_values["generation"][COAL] = p.capacities[COAL]["power"] * coal_share
    new_values["generation"][NUCLEAR] = p.capacities[NUCLEAR]["power"] * nuclear_share
    new_values["demand"][MINE] = p.capacities[MINE]["power_use"] * mine_share

    resources_and_pollution(new_values, p)

    return new_values["op_costs"]


def _maximum(p: Player, facility: str) -> float:
    return p.capacities[facility]["O&M_cost"]


def test_renewable_and_storage_facilities_pay_their_full_cost_however_little_they_run(player: Player) -> None:
    op_costs = _run(player, 0.5, 0.5, 0.5)

    assert op_costs[WIND] == pytest.approx(-_maximum(player, WIND))
    assert op_costs[BATTERY] == pytest.approx(-_maximum(player, BATTERY))


def test_a_controllable_facility_pays_a_fifth_fixed_and_the_rest_by_utilisation(player: Player) -> None:
    op_costs = _run(player, coal_share=0.25, nuclear_share=0.0, mine_share=0.0)

    assert op_costs[COAL] == pytest.approx(-_maximum(player, COAL) * (0.2 + 0.8 * 0.25))


def test_a_nuclear_reactor_pays_half_fixed_and_the_rest_by_utilisation(player: Player) -> None:
    op_costs = _run(player, coal_share=0.0, nuclear_share=0.5, mine_share=0.0)

    assert op_costs[NUCLEAR] == pytest.approx(-_maximum(player, NUCLEAR) * (0.5 + 0.5 * 0.5))


def test_an_extraction_facility_pays_a_fifth_fixed_and_the_rest_by_how_much_it_extracts(player: Player) -> None:
    op_costs = _run(player, coal_share=0.0, nuclear_share=0.0, mine_share=0.75)

    assert op_costs[MINE] == pytest.approx(-_maximum(player, MINE) * (0.2 + 0.8 * 0.75))


def test_an_idle_facility_still_pays_its_fixed_share(player: Player) -> None:
    op_costs = _run(player, 0.0, 0.0, 0.0)

    assert op_costs[COAL] == pytest.approx(-_maximum(player, COAL) * 0.2)
    assert op_costs[NUCLEAR] == pytest.approx(-_maximum(player, NUCLEAR) * 0.5)
    assert op_costs[MINE] == pytest.approx(-_maximum(player, MINE) * 0.2)


def test_the_player_is_charged_the_total(player: Player) -> None:
    before = player.money

    op_costs = _run(player, 0.4, 0.6, 0.2)

    assert player.money - before == pytest.approx(sum(op_costs.values()))
