"""Engine state pickled before a module moved still loads (#1055, #1056, #1057).

Pickle records each object's class by its module path. Every ``instance/engine_data.pck`` and
checkpoint written before #1055 names the entity models ``energetica.database.*``, which now live
under ``energetica.freeplay.database``. Every one written before #1056 names the enumerations
``energetica.enums``, which now live at ``energetica.freeplay.enums``. Every one written before #1057
names the API schemas a player holds, such as push subscriptions, ``energetica.schemas.*``, which now
live under ``energetica.freeplay.schemas``. The pickles here are written
at protocol 0, whose opcodes are plain text, so an old-layout pickle can be made by rewriting the
module path in the bytes.
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
from energetica.freeplay.enums import ControllableFacilityType, Fuel
from energetica.freeplay.routers import charts
from energetica.freeplay.schemas.browser_notifications import Subscription, SubscriptionKeys
from energetica.freeplay.utils.map_helpers import confirm_location
from energetica.freeplay.utils.misc import save_past_data
from energetica.identity.account import Account


def _account() -> Account:
    return Account(account_id=1, username="username")


def _to_old_layout(current: bytes) -> bytes:
    """Rewrite a protocol-0 pickle to name its classes as they were pickled before #1055, #1056 and #1057."""
    old_layout = current.replace(b"energetica.freeplay.schemas", b"energetica.schemas")
    old_layout = old_layout.replace(b"energetica.freeplay.database", b"energetica.database")
    old_layout = old_layout.replace(b"energetica.freeplay.enums", b"energetica.enums")
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


def test_an_enumeration_pickled_under_its_old_module_path_loads_as_the_moved_enumeration() -> None:
    current = pickle.dumps({"reserves": {Fuel.COAL: 3.0}}, protocol=0)
    old_layout = _to_old_layout(current)

    loaded = legacy_pickle.load(io.BytesIO(old_layout))

    assert loaded == {"reserves": {Fuel.COAL: 3.0}}
    assert type(next(iter(loaded["reserves"]))) is Fuel


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
    # Written just above, under the current module paths.
    with engine_data.open("rb") as file:
        state = pickle.load(file)  # noqa: TID251
    engine_data.write_bytes(_to_old_layout(pickle.dumps(state, protocol=0)))
    engine.clear_db()

    engine.load()

    loaded = Player.getitem(player.id)
    assert loaded.username == "username"
    assert loaded.tile is not None and loaded.tile.coordinates == player.tile.coordinates
    assert HexTile.count() == tile_count


def test_a_push_subscription_saved_under_the_old_module_path_loads_through_engine_load() -> None:
    """A player who turned on push notifications holds ``Subscription`` objects in the engine save."""
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    player = confirm_location(_account(), HexTile.getitem(1))
    subscription = Subscription(
        endpoint="https://push.example.com/abc", keys=SubscriptionKeys(p256dh="p256dh-key", auth="auth-key")
    )
    player.push_subscriptions.append(subscription)
    engine.save()

    engine_data = Path("instance/engine_data.pck")
    # Written just above, under the current module paths.
    with engine_data.open("rb") as file:
        state = pickle.load(file)  # noqa: TID251
    old_layout = _to_old_layout(pickle.dumps(state, protocol=0))
    assert b"energetica.schemas.browser_notifications" in old_layout
    engine_data.write_bytes(old_layout)
    engine.clear_db()

    engine.load()

    assert Player.getitem(player.id).push_subscriptions == [subscription]


def _rewrite_to_old_layout(path: Path) -> None:
    """Rewrite a pickle file in place to name its classes as they were pickled before #1056."""
    # The caller has just written the file under the current module paths.
    with path.open("rb") as file:
        state = pickle.load(file)  # noqa: TID251
    old_layout = _to_old_layout(pickle.dumps(state, protocol=0))
    assert b"energetica.enums" in old_layout
    path.write_bytes(old_layout)


def _player_with_saved_history() -> tuple[Player, Path]:
    """A player whose chart history file holds an enum key, as after building a coal burner.

    A new player's file starts from a template with string keys. A facility type outside that
    template is added under its enum, which the next 216-tick save writes to the file.
    """
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    player = confirm_location(_account(), HexTile.getitem(1))
    player.rolling_history.add_subcategory("generation", ControllableFacilityType.COAL_BURNER)
    save_past_data()
    return player, Path(f"instance/data/players/player_{player.id}.pck")


def test_the_history_save_extends_a_player_history_file_written_under_the_old_module_paths() -> None:
    """Chart history files are pickled too, and their keys include enums such as facility types."""
    _player, history = _player_with_saved_history()
    _rewrite_to_old_layout(history)

    save_past_data()

    # The save above rewrote the file under the current module paths.
    with history.open("rb") as file:
        saved = pickle.load(file)  # noqa: TID251
    assert ControllableFacilityType.COAL_BURNER in saved["generation"]


def test_the_chart_reader_reads_a_player_history_file_written_under_the_old_module_paths() -> None:
    _player, history = _player_with_saved_history()
    _rewrite_to_old_layout(history)

    loaded = charts._load_pickle_data(str(history))

    assert ControllableFacilityType.COAL_BURNER in loaded["generation"]
