"""Test upgrading active facilities."""

from energetica import create_app
from energetica.database.map.hex_tile import HexTile
from energetica.database.user import User
from energetica.enums import (
    Fuel,
    FunctionalFacilityType,
)
from energetica.init_test_players import add_asset
from energetica.utils.auth import generate_password_hash
from energetica.utils.map_helpers import confirm_location
from energetica.utils.resource_market import create_ask, purchase_resource, store_import


def test_store_import() -> None:
    """Test upgrading active facilities."""
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")
    user1 = User(username="username", pwhash=generate_password_hash("password"), role="player")
    hex_tile = HexTile.getitem(1)
    player1 = confirm_location(user1, hex_tile)

    add_asset(player1, FunctionalFacilityType.WAREHOUSE, 1)
    assert player1.resources[Fuel.COAL] == 0

    # The warehouse has capacity for 500,000, so all the shipment can be stored
    store_import(player1, Fuel.COAL, 250_000)
    assert player1.resources[Fuel.COAL] == 250_000

    # The warehouse cannot store more than its capacity, the rest is stored in the ground
    stored_and_ground = player1.tile.fuel_reserves[Fuel.COAL] + player1.resources[Fuel.COAL]
    store_import(player1, Fuel.COAL, 1_000_000)

    # Check that the warehouse is full
    assert player1.resources[Fuel.COAL] == 500_000

    # Check that the ground storage has increased, and that conservation of mass holds
    new_stored_and_ground = player1.tile.fuel_reserves[Fuel.COAL] + player1.resources[Fuel.COAL]
    assert new_stored_and_ground - stored_and_ground == 1_000_000


def test_purchase_resource() -> None:
    """Test purchasing a resource off the resource market."""
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")
    user1 = User(username="user1", pwhash=generate_password_hash("password"), role="player")
    user2 = User(username="user2", pwhash=generate_password_hash("password"), role="player")
    player1 = confirm_location(user1, HexTile.getitem(1))
    player2 = confirm_location(user2, HexTile.getitem(2))
    add_asset(player1, FunctionalFacilityType.WAREHOUSE, 1)
    add_asset(player2, FunctionalFacilityType.WAREHOUSE, 1)
    player1.resources[Fuel.COAL] = 250_000
    player1.money = 0
    sale = create_ask(player1, Fuel.COAL, 100_000, 1)
    player2.money = 200_000
    assert player2.resources[Fuel.COAL] == 0
    remaining_sale = purchase_resource(player2, 100_000, sale)
    assert player2.resources[Fuel.COAL] == 100_000
    assert player2.money == 100_000
    assert player1.resources[Fuel.COAL] == 150_000
    assert player1.money == 100_000
