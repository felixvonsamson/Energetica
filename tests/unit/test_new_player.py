"""Unit tests for new player logic."""

from energetica import create_app
from energetica.accounts import Account
from energetica.database.map.hex_tile import HexTile
from energetica.utils.auth import generate_password_hash
from energetica.utils.map_helpers import confirm_location


def test() -> None:
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    account = Account(
        account_id=1, username="username", pwhash=generate_password_hash("password"), email=None, created_at=""
    )
    hex_tile = HexTile.getitem(1)
    confirm_location(account, hex_tile)
