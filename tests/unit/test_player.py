"""Tests for the Player class."""

from energetica import create_app
from energetica.database.map.hex_tile import HexTile
from energetica.database.user import User
from energetica.utils.auth import generate_password_hash
from energetica.utils.map_helpers import confirm_location


def test_player_creation_and_location_confirmation() -> None:
    """Test the creation of a player and the confirmation of a location."""
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    player = User(username="username", pwhash=generate_password_hash("password"), role="player")
    hex_tile = HexTile.getitem(1)
    confirm_location(player, hex_tile)


def test_player_hashable() -> None:
    """
    Test the hashability of the Player class.

    Hashability is required for the Player class to be used as a key in a dictionary or a set.
    This is the case for Chat's participants attribute, which is a set of Player instances.
    """
    user = User(username="username", pwhash=generate_password_hash("password"), role="player")
    hex_tile = HexTile.getitem(1)
    player = confirm_location(user, hex_tile)
    assert hash(player)
