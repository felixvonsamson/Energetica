"""Engine state pickled before a module moved still loads (#1055).

Pickle records each object's class by its module path. Every ``instance/engine_data.pck`` and
checkpoint written before #1055 names the entity models ``energetica.database.*``, which now live
under ``energetica.freeplay.database``. The pickles here are written at protocol 0, whose opcodes are
plain text, so an old-layout pickle can be made by rewriting the module path in the bytes.
"""

from __future__ import annotations

import io
import pickle
from pathlib import Path

from energetica.freeplay import engine, legacy_pickle
from energetica.freeplay.app import create_app
from energetica.freeplay.database.engine_data.cumulative_emissions_data import CumulativeEmissionsData
from energetica.freeplay.database.map.hex_tile import HexTile
from energetica.freeplay.database.player import Player
from energetica.identity.accounts import Account
from energetica.kernel.session import generate_password_hash
from energetica.utils.map_helpers import confirm_location


def _account() -> Account:
    return Account(
        account_id=1, username="username", pwhash=generate_password_hash("password"), email=None, created_at=""
    )


def _to_old_layout(current: bytes) -> bytes:
    """Rewrite a protocol-0 pickle to name its classes as they were pickled before #1055."""
    old_layout = current.replace(b"energetica.freeplay.database", b"energetica.database")
    assert b"energetica.freeplay" not in old_layout
    return old_layout


def _emissions() -> CumulativeEmissionsData:
    emissions = CumulativeEmissionsData()
    emissions.add("steam_engine", 12.5)
    return emissions


def test_a_pickle_naming_the_old_module_path_loads_as_the_moved_class() -> None:
    current = pickle.dumps({"current_climate_data": _emissions()}, protocol=0)
    old_layout = _to_old_layout(current)

    loaded = legacy_pickle.load(io.BytesIO(old_layout))

    assert isinstance(loaded["current_climate_data"], CumulativeEmissionsData)
    assert loaded["current_climate_data"].get_all() == {"steam_engine": 12.5, "construction": 0.0}


def test_a_pickle_naming_the_current_module_path_still_loads() -> None:
    current = pickle.dumps({"current_climate_data": _emissions()})

    loaded = legacy_pickle.load(io.BytesIO(current))

    assert loaded["current_climate_data"].get_all() == {"steam_engine": 12.5, "construction": 0.0}


def test_a_full_engine_save_under_the_old_module_paths_loads_through_engine_load() -> None:
    """The whole model store, not one object, restored by the path a restart takes.

    ``engine.load()`` also rebuilds indexes and updates each player's capacities, so this covers
    the restoration work that follows unpickling as well as every class the store holds.
    """
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    player = confirm_location(_account(), HexTile.getitem(1))
    tile_count = HexTile.count()
    engine.save()

    engine_data = Path("instance/engine_data.pck")
    with engine_data.open("rb") as file:
        state = pickle.load(file)
    engine_data.write_bytes(_to_old_layout(pickle.dumps(state, protocol=0)))
    engine.clear_db()

    engine.load()

    loaded = Player.getitem(player.id)
    assert loaded.username == "username"
    assert loaded.tile is not None and loaded.tile.coordinates == player.tile.coordinates
    assert HexTile.count() == tile_count
