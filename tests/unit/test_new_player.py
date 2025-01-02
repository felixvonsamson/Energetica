import os
import sys

sys.path.append(os.getcwd())

from werkzeug.security import generate_password_hash

from energetica import create_app
from energetica.database.map import HexTile
from energetica.database.player import Player
from energetica.globals import engine
from energetica.utils.misc import confirm_location


def test():
    create_app(rm_instance=True, skip_adding_handlers=True)
    player = Player(username="username", pwhash=generate_password_hash("password"))
    hex_tile = HexTile.get(1)
    confirm_location(player, hex_tile)
