"""Test upgrading active facilities."""

from energetica import create_app
from energetica.database.map.hex_tile import HexTile
from energetica.database.player import Player
from energetica.enums import (
    Fuel,
    FunctionalFacilityType,
)
from energetica.init_test_players import add_asset
from energetica.utils.auth import generate_password_hash
from energetica.utils.map_helpers import confirm_location
from energetica.utils.resource_market import store_import


def test_store_import() -> None:
    """Test upgrading active facilities."""
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")
    player1 = Player(username="username", pwhash=generate_password_hash("password"))
    hex_tile = HexTile.getitem(1)
    confirm_location(player1, hex_tile)

    add_asset(player1, FunctionalFacilityType.WAREHOUSE, 1)
    assert player1.resources[Fuel.COAL] == 0

    store_import(player1, Fuel.COAL, 250_000)
    assert player1.resources[Fuel.COAL] == 250_000

    store_import(player1, Fuel.COAL, 1_000_000)
    assert player1.resources[Fuel.COAL] == 500_000
