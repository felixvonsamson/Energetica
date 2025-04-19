from werkzeug.security import generate_password_hash

from energetica import create_app
from energetica.database.map import HexTile
from energetica.database.player import Player
from energetica.utils.misc import confirm_location


def test_player_creation_and_location_confirmation():
    """Test the creation of a player and the confirmation of a location."""
    create_app(rm_instance=True, skip_adding_handlers=True)
    player = Player(username="username", pwhash=generate_password_hash("password"))
    hex_tile = HexTile.getitem(1)
    confirm_location(player, hex_tile)


def test_player_hashable():
    """
    Test the hashability of the Player class.

    Hashability is required for the Player class to be used as a key in a dictionary or a set.
    This is the case for Chat's participants attribute, which is a set of Player instances.
    """
    player = Player(username="username", pwhash=generate_password_hash("password"))
    assert hash(player)
