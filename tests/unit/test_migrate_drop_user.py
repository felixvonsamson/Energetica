"""Unit tests for the drop-User pickle migration (ADR-0004).

Retiring ``energetica.database.user.User`` means an existing pre-migration pickle can no longer
be loaded at all with a plain ``pickle.load`` — the class must still be importable at its
original module path to reconstruct any instance of it. These tests build pickle bytes shaped
like a pre-migration save (a real, deletable ``energetica.database.user.User`` registered only
for the duration of the fixture) and verify the migration's compatibility unpickler and
field-move logic against them.
"""

from __future__ import annotations

import importlib.util
import io
import pickle
import sys
import types
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest

_SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "migrate-drop-user.py"


def _load_script() -> ModuleType:
    spec = importlib.util.spec_from_file_location("migrate_drop_user", _SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    # The script defines a @dataclass, whose field-type resolution looks itself up in
    # sys.modules[cls.__module__] — it must be registered before exec_module runs the class body.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def legacy_engine_pickle() -> bytes:
    """Pickle bytes shaped like a pre-migration engine save: one Player still carrying a legacy
    ``user`` attribute (referencing a real, but only-temporarily-registered, class at
    ``energetica.database.user.User``) and one already-migrated Player with no ``user`` at all.
    The fake module is removed again before the test runs the migration against these bytes, so
    unpickling genuinely exercises the compatibility path rather than just importing the real
    (deleted) module.
    """
    fake_module = types.ModuleType("energetica.database.user")

    class User:
        def __init__(self, username: str, pwhash: str, role: str, account_id: int) -> None:
            self.username = username
            self.pwhash = pwhash
            self.role = role
            self.account_id = account_id
            self.player = None

    User.__module__ = "energetica.database.user"
    User.__qualname__ = "User"
    fake_module.User = User  # type: ignore[attr-defined]
    sys.modules["energetica.database.user"] = fake_module
    try:
        unmigrated_player = SimpleNamespace(user=User("alice", "hash-a", "player", 7), tile=None)
        already_migrated_player = SimpleNamespace(username="bob", pwhash="hash-b", account_id=8, tile=None)
        engine_state = {
            "db_model_instances": {
                "Player": {1: unmigrated_player, 2: already_migrated_player},
                "User": {1: unmigrated_player.user},
            }
        }
        return pickle.dumps(engine_state)
    finally:
        del sys.modules["energetica.database.user"]


def test_compat_unpickler_loads_a_pickle_with_the_deleted_user_class(legacy_engine_pickle: bytes) -> None:
    """The whole point: this must not raise ModuleNotFoundError even though
    energetica.database.user no longer exists anywhere in the current process.
    """
    module = _load_script()

    engine_state = module._CompatUnpickler(io.BytesIO(legacy_engine_pickle)).load()

    assert set(engine_state["db_model_instances"]["Player"]) == {1, 2}


def test_migrate_players_moves_fields_off_the_legacy_user_and_drops_it(legacy_engine_pickle: bytes) -> None:
    module = _load_script()
    engine_state = module._CompatUnpickler(io.BytesIO(legacy_engine_pickle)).load()
    player_table = engine_state["db_model_instances"]["Player"]

    migrated, skipped = module.migrate_players(player_table)

    assert migrated == 1
    assert skipped == 1
    unmigrated = player_table[1]
    assert unmigrated.username == "alice"
    assert unmigrated.pwhash == "hash-a"
    assert unmigrated.account_id == 7
    assert "user" not in unmigrated.__dict__
    # The already-migrated player is untouched.
    assert player_table[2].username == "bob"


def test_migrate_players_dry_run_does_not_mutate(legacy_engine_pickle: bytes) -> None:
    module = _load_script()
    engine_state = module._CompatUnpickler(io.BytesIO(legacy_engine_pickle)).load()
    player_table = engine_state["db_model_instances"]["Player"]

    migrated, skipped = module.migrate_players(player_table, dry_run=True)

    assert migrated == 1
    assert skipped == 1
    assert "user" in player_table[1].__dict__
    assert "username" not in player_table[1].__dict__


def test_migrate_players_is_idempotent(legacy_engine_pickle: bytes) -> None:
    module = _load_script()
    engine_state = module._CompatUnpickler(io.BytesIO(legacy_engine_pickle)).load()
    player_table = engine_state["db_model_instances"]["Player"]

    module.migrate_players(player_table)
    migrated_again, skipped_again = module.migrate_players(player_table)

    assert migrated_again == 0
    assert skipped_again == 2
