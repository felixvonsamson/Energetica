"""Unit tests for the facilitator instance-admin auth dependency (#1019).

``get_admin_user`` is the backend gate every facilitator route depends on: it restricts a route to
``User.is_admin`` (``role == "admin"``), independent of the request itself — so these tests
monkeypatch ``auth.get_user`` (the cookie → local ``User`` resolver) the same way
``test_freeze_enforcement.py`` monkeypatches ``instance_config.current_phase`` for
``reject_when_frozen``, rather than driving a real HTTP request through a route.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException, status

from energetica.database.user import User
from energetica.game_error import GameExceptionType
from energetica.utils import auth


def _user(role: str) -> User:
    return User(username="alice", pwhash="unused", role=role, account_id=1)  # type: ignore[arg-type]


def test_get_admin_user_returns_the_user_for_an_admin(monkeypatch: pytest.MonkeyPatch) -> None:
    admin = _user("admin")
    monkeypatch.setattr(auth, "get_user", lambda request: admin)

    assert auth.get_admin_user(request=None) is admin  # type: ignore[arg-type]


def test_get_admin_user_rejects_a_player(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth, "get_user", lambda request: _user("player"))

    with pytest.raises(HTTPException) as excinfo:
        auth.get_admin_user(request=None)  # type: ignore[arg-type]
    assert excinfo.value.status_code == status.HTTP_403_FORBIDDEN
    assert excinfo.value.detail == GameExceptionType.USER_IS_NOT_AN_ADMIN


def test_get_admin_user_rejects_no_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth, "get_user", lambda request: None)

    with pytest.raises(HTTPException) as excinfo:
        auth.get_admin_user(request=None)  # type: ignore[arg-type]
    assert excinfo.value.status_code == status.HTTP_403_FORBIDDEN
    assert excinfo.value.detail == GameExceptionType.USER_IS_NOT_AN_ADMIN
