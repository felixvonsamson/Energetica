"""Integration test for the ``get_facilitator`` FastAPI dependency (#1019).

There is no production facilitator route yet (#1019 is plumbing only, ahead of #989's actual
surfaces) — this test mounts a single throwaway route behind ``Depends(get_facilitator)`` on a real
app, so the dependency is exercised the way a real facilitator route will use it: through FastAPI's
dependency injection and the actual HTTP response, not just a direct function call (see
``tests/unit/test_facilitator_auth.py`` for the direct-call unit tests).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient

from energetica import accounts, create_app
from energetica.accounts import Account
from energetica.globals import engine
from energetica.utils.auth import get_facilitator

from ._session_helpers import authenticate, make_account

PORT = 8000
ADMIN_ONLY_URL = f"http://localhost:{PORT}/api/v1/_test/admin-only"


def _client() -> TestClient:
    app = create_app(rm_instance=True, skip_adding_handlers=True, env="dev", port=PORT)
    engine.serve_local = False

    test_router = APIRouter()

    @test_router.get("/_test/admin-only")
    def admin_only(account: Annotated[Account, Depends(get_facilitator)]) -> dict[str, str]:
        return {"username": account.username}

    app.include_router(test_router, prefix="/api/v1")
    return TestClient(app)


def test_admin_only_route_rejects_unauthenticated() -> None:
    client = _client()
    assert client.get(ADMIN_ONLY_URL).status_code == 403


def test_admin_only_route_rejects_a_player_account() -> None:
    client = _client()
    account_id = make_account("alice", "pw")
    authenticate(client, account_id)

    assert client.get(ADMIN_ONLY_URL).status_code == 403


def test_admin_only_route_allows_a_facilitator_account() -> None:
    client = _client()
    account_id = make_account("alice", "pw")
    accounts.grant_facilitator(account_id=account_id, slug=None)
    authenticate(client, account_id)

    response = client.get(ADMIN_ONLY_URL)
    assert response.status_code == 200
    assert response.json() == {"username": "alice"}
