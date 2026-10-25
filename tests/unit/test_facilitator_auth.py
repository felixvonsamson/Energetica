"""Unit tests for the facilitator instance-admin auth dependency (#1019).

``get_facilitator`` is the backend gate every facilitator route depends on: it restricts a route
to an account holding a facilitator grant (ADR-0004), which the lobby service reports with the
session — so these tests monkeypatch ``web.get_standing`` the same way
``test_freeze_enforcement.py`` monkeypatches ``instance_config.current_phase`` for
``reject_when_frozen``, rather than driving a real HTTP request through a route.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException, status

from energetica.identity import web
from energetica.identity.account import Account, Role
from energetica.identity.game_error import IdentityErrorCode


def _standing(role: Role) -> web.Standing:
    return web.Standing(account=Account(account_id=1, username="alice"), role=role, joined=None)


def test_get_facilitator_returns_the_account_for_a_facilitator(monkeypatch: pytest.MonkeyPatch) -> None:
    standing = _standing("facilitator")
    monkeypatch.setattr(web, "get_standing", lambda request: standing)

    assert web.get_facilitator(request=None) is standing.account  # type: ignore[arg-type]


def test_get_facilitator_rejects_a_player(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(web, "get_standing", lambda request: _standing("player"))

    with pytest.raises(HTTPException) as excinfo:
        web.get_facilitator(request=None)  # type: ignore[arg-type]
    assert excinfo.value.status_code == status.HTTP_403_FORBIDDEN
    assert excinfo.value.detail == IdentityErrorCode.ACCOUNT_IS_NOT_A_FACILITATOR


def test_get_facilitator_rejects_no_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(web, "get_standing", lambda request: None)

    with pytest.raises(HTTPException) as excinfo:
        web.get_facilitator(request=None)  # type: ignore[arg-type]
    assert excinfo.value.status_code == status.HTTP_403_FORBIDDEN
    assert excinfo.value.detail == IdentityErrorCode.ACCOUNT_IS_NOT_A_FACILITATOR
