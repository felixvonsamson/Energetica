from energetica import create_app
from energetica.auth import generate_password_hash
from energetica.database.map import HexTile
from energetica.database.player import Player
from energetica.utils.map_helpers import confirm_location


def test() -> None:
    create_app(rm_instance=True, skip_adding_handlers=True)
    player = Player(username="username", pwhash=generate_password_hash("password"))
    hex_tile = HexTile.getitem(1)
    confirm_location(player, hex_tile)
