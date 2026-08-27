"""Tests for the Player class."""

from energetica import create_app
from energetica.accounts import Account
from energetica.database.map.hex_tile import HexTile
from energetica.utils.auth import generate_password_hash
from energetica.utils.map_helpers import confirm_location


def _account(account_id: int = 1, username: str = "username") -> Account:
    return Account(
        account_id=account_id, username=username, pwhash=generate_password_hash("password"), email=None, created_at=""
    )


def test_player_creation_and_location_confirmation() -> None:
    """Test the creation of a player and the confirmation of a location."""
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    hex_tile = HexTile.getitem(1)
    confirm_location(_account(), hex_tile)


def test_player_hashable() -> None:
    """
    Test the hashability of the Player class.

    Hashability is required for the Player class to be used as a key in a dictionary or a set.
    This is the case for Chat's participants attribute, which is a set of Player instances.
    """
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    hex_tile = HexTile.getitem(1)
    player = confirm_location(_account(), hex_tile)
    assert hash(player)
