"""Tests for the account_id field on pickle User and unpickle behaviour."""

from __future__ import annotations

import pickle

import pytest

from energetica import create_app
from energetica.database.user import User
from energetica.utils.auth import generate_password_hash


def test_user_requires_account_id() -> None:
    """Constructing a User without an account_id is a type error / construction error."""
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")

    with pytest.raises(TypeError):
        User(username="alice", pwhash=generate_password_hash("pw"), role="player")  # type: ignore[call-arg]


def test_user_round_trip_pickle_preserves_account_id() -> None:
    """A pickled-then-unpickled User keeps its account_id."""
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    user = User(
        username="alice",
        pwhash=generate_password_hash("pw"),
        role="player",
        account_id=42,
    )

    restored = pickle.loads(pickle.dumps(user))

    assert restored.account_id == 42


def test_unpickling_legacy_user_without_account_id_raises_clear_error() -> None:
    """An old pickle missing account_id must raise a clear error, not AttributeError later."""
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    user = User(
        username="alice",
        pwhash=generate_password_hash("pw"),
        role="player",
        account_id=1,
    )

    legacy_state = {k: v for k, v in user.__dict__.items() if k != "account_id"}

    with pytest.raises(RuntimeError, match="migrate-to-server-accounts"):
        user.__setstate__(legacy_state)  # type: ignore[attr-defined]