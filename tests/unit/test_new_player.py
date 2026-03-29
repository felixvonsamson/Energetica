"""Unit tests for new player logic."""

from energetica import create_app
from energetica.database.map.hex_tile import HexTile
from energetica.database.user import User
from energetica.utils.auth import generate_password_hash
from energetica.utils.map_helpers import confirm_location


def test() -> None:
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    user = User(username="username", pwhash=generate_password_hash("password"), role="player")
    hex_tile = HexTile.getitem(1)
    confirm_location(user, hex_tile)
