import os
import sys

sys.path.append(os.getcwd())

from energetica import create_app
from energetica.database import db
from energetica.database.map import Hex
from energetica.database.player import Player
from energetica.utils.misc import confirm_location
from werkzeug.security import generate_password_hash


def test():
    _, app = create_app(rm_instance=True)
    app.app_context().push()
    engine = app.config["engine"]
    player = Player(username="username100", pwhash=generate_password_hash("password"))
    db.session.add(player)
    db.session.commit()
    hex_tile = db.session.get(Hex, 1)
    confirm_location(engine, player, hex_tile)
    db.session.commit()
    assert True
