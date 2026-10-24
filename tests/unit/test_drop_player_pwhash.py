"""Unit tests for the one-off script that drops ``pwhash`` from saved players (issue #1341).

``Player`` no longer declares ``pwhash``, but a pickle saved before that still carries it in each
player's ``__dict__``. The script removes it. These tests cover the edit on the unpickled engine
state, and a round trip through ``engine.save()``, the script and ``engine.load()``.
"""

from __future__ import annotations

import importlib.util
import pickle
from pathlib import Path
from types import ModuleType

from energetica.freeplay import engine
from energetica.freeplay.app import create_app
from energetica.freeplay.database.map.hex_tile import HexTile
from energetica.freeplay.database.player import Player
from energetica.identity.accounts import Account
from energetica.utils.map_helpers import confirm_location

_SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "instance" / "drop_player_pwhash.py"
_PICKLE = Path("instance/engine_data.pck")


def _load_script() -> ModuleType:
    spec = importlib.util.spec_from_file_location("drop_player_pwhash", _SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _SavedPlayer:
    """Stands in for a ``Player``: the script only touches ``__dict__``."""

    def __init__(self, **attributes: object) -> None:
        self.__dict__.update(attributes)


def _engine_state(*players: _SavedPlayer) -> dict:
    return {"db_model_instances": {"Player": dict(enumerate(players, start=1))}}


def test_drop_player_pwhash_removes_the_field_from_every_player() -> None:
    module = _load_script()
    alice = _SavedPlayer(username="alice", pwhash="hash-a", account_id=1)
    bob = _SavedPlayer(username="bob", pwhash="hash-b", account_id=2)

    dropped, already_clean = module.drop_player_pwhash(_engine_state(alice, bob))

    assert (dropped, already_clean) == (2, 0)
    assert alice.__dict__ == {"username": "alice", "account_id": 1}
    assert bob.__dict__ == {"username": "bob", "account_id": 2}


def test_drop_player_pwhash_counts_players_that_have_no_pwhash() -> None:
    module = _load_script()
    migrated = _SavedPlayer(username="alice", account_id=1)
    unmigrated = _SavedPlayer(username="bob", pwhash="hash-b", account_id=2)

    dropped, already_clean = module.drop_player_pwhash(_engine_state(migrated, unmigrated))

    assert (dropped, already_clean) == (1, 1)
    assert "pwhash" not in unmigrated.__dict__


def test_drop_player_pwhash_handles_a_run_with_no_players() -> None:
    module = _load_script()

    assert module.drop_player_pwhash({"db_model_instances": {}}) == (0, 0)


def _save_a_pickle_with_a_pwhash() -> int:
    """Save a run whose one player carries ``pwhash``, as a pickle written before #1341 does."""
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    account = Account(account_id=1, username="alice", pwhash="hash-a", email=None, created_at="")
    player = confirm_location(account, HexTile.getitem(1))
    player.__dict__["pwhash"] = "hash-a"
    engine.save()
    engine.clear_db()
    assert b"pwhash" in _PICKLE.read_bytes()
    return player.id


def test_the_script_strips_pwhash_from_a_saved_run_that_still_loads() -> None:
    module = _load_script()
    player_id = _save_a_pickle_with_a_pwhash()

    assert module.main(["--pickle", str(_PICKLE), "--no-backup"]) == 0

    assert b"pwhash" not in _PICKLE.read_bytes()
    engine.load()
    loaded = Player.getitem(player_id)
    assert loaded.username == "alice"
    assert "pwhash" not in loaded.__dict__


def test_a_dry_run_leaves_the_pickle_untouched() -> None:
    module = _load_script()
    _save_a_pickle_with_a_pwhash()
    before = _PICKLE.read_bytes()

    assert module.main(["--pickle", str(_PICKLE), "--dry-run"]) == 0

    assert _PICKLE.read_bytes() == before


def test_the_script_backs_up_the_pickle_before_overwriting_it() -> None:
    module = _load_script()
    _save_a_pickle_with_a_pwhash()
    before = _PICKLE.read_bytes()

    assert module.main(["--pickle", str(_PICKLE)]) == 0

    backups = list(_PICKLE.parent.glob(f"{_PICKLE.name}.bak-*"))
    assert len(backups) == 1
    assert backups[0].read_bytes() == before
    backups[0].unlink()


def test_a_second_run_reports_nothing_to_do_and_leaves_the_pickle_alone() -> None:
    module = _load_script()
    _save_a_pickle_with_a_pwhash()
    assert module.main(["--pickle", str(_PICKLE), "--no-backup"]) == 0
    after_first_run = _PICKLE.read_bytes()

    assert module.main(["--pickle", str(_PICKLE)]) == 0

    assert _PICKLE.read_bytes() == after_first_run
    assert list(_PICKLE.parent.glob(f"{_PICKLE.name}.bak-*")) == []
    assert pickle.loads(after_first_run)["db_model_instances"]["Player"]
