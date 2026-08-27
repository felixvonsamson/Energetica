"""Unit tests for the facilitator instance-admin auth dependency (#1019).

``get_facilitator`` is the backend gate every facilitator route depends on: it restricts a route
to an account holding a facilitator grant (ADR-0004), read straight from ``accounts.db`` — so
these tests monkeypatch ``auth.get_current_account``/``accounts.is_facilitator`` the same way
``test_freeze_enforcement.py`` monkeypatches ``instance_config.current_phase`` for
``reject_when_frozen``, rather than driving a real HTTP request through a route.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException, status

from energetica import accounts
from energetica.accounts import Account
from energetica.game_error import GameExceptionType
from energetica.utils import auth


def _account(account_id: int = 1) -> Account:
    return Account(account_id=account_id, username="alice", pwhash="unused", email=None, created_at="")


def test_get_facilitator_returns_the_account_for_a_facilitator(monkeypatch: pytest.MonkeyPatch) -> None:
    account = _account()
    monkeypatch.setattr(auth, "get_current_account", lambda request: account)
    monkeypatch.setattr(accounts, "is_facilitator", lambda **kwargs: True)

    assert auth.get_facilitator(request=None) is account  # type: ignore[arg-type]


def test_get_facilitator_rejects_a_player(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth, "get_current_account", lambda request: _account())
    monkeypatch.setattr(accounts, "is_facilitator", lambda **kwargs: False)

    with pytest.raises(HTTPException) as excinfo:
        auth.get_facilitator(request=None)  # type: ignore[arg-type]
    assert excinfo.value.status_code == status.HTTP_403_FORBIDDEN
    assert excinfo.value.detail == GameExceptionType.ACCOUNT_IS_NOT_A_FACILITATOR


def test_get_facilitator_rejects_no_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth, "get_current_account", lambda request: None)

    with pytest.raises(HTTPException) as excinfo:
        auth.get_facilitator(request=None)  # type: ignore[arg-type]
    assert excinfo.value.status_code == status.HTTP_403_FORBIDDEN
    assert excinfo.value.detail == GameExceptionType.ACCOUNT_IS_NOT_A_FACILITATOR
