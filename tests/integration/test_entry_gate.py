"""Integration tests for the instance entry gate (``GET /api/v1/auth/me``).

Post-cutover the instance mints no sessions: it validates the shared-secret SSO cookie the lobby
set (carrying the ``account_id``) and, on the account's first authenticated visit, auto-provisions
a local ``User`` — the entry gate. Provisioning moved out of the retired ``/login`` POST into this
authenticated-entry path (#817, ADR-0002/0003).
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from energetica import create_app
from energetica.database.user import User
from energetica.globals import engine
from energetica.utils.session import SESSION_COOKIE_NAME, serializer

from ._session_helpers import authenticate, make_account

PORT = 8000
ME_URL = f"http://localhost:{PORT}/api/v1/auth/me"


def _client() -> TestClient:
    app = create_app(rm_instance=True, skip_adding_handlers=True, env="dev", port=PORT)
    engine.serve_local = False
    return TestClient(app)


def test_no_cookie_is_401() -> None:
    assert _client().get(ME_URL).status_code == 401


def test_tampered_cookie_is_401() -> None:
    client = _client()
    client.cookies.set(SESSION_COOKIE_NAME, "not-a-valid-signed-token")
    assert client.get(ME_URL).status_code == 401


def test_valid_cookie_for_unknown_account_is_401() -> None:
    """A validly-signed session for an account_id with no server-wide row (e.g. deleted) is 401,
    not a crash and not an auto-provision.
    """
    client = _client()
    client.cookies.set(SESSION_COOKIE_NAME, serializer.dumps("999999"))
    assert client.get(ME_URL).status_code == 401


def test_entry_gate_auto_provisions_local_user_on_first_visit() -> None:
    """A server-wide account with a valid session but no local User yet is provisioned on entry:
    role=player, no Player (that happens later at settle).
    """
    client = _client()
    account_id = make_account("visitor")
    assert next(User.filter_by(account_id=account_id), None) is None
    authenticate(client, account_id)

    response = client.get(ME_URL)

    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "visitor"
    assert body["role"] == "player"
    assert body["is_settled"] is False
    provisioned = next(User.filter_by(account_id=account_id), None)
    assert provisioned is not None
    assert provisioned.role == "player"
    assert provisioned.player is None


def test_entry_gate_is_idempotent_and_does_not_duplicate_the_user() -> None:
    client = _client()
    account_id = make_account("visitor")
    authenticate(client, account_id)

    assert client.get(ME_URL).status_code == 200
    assert client.get(ME_URL).status_code == 200

    assert len(list(User.filter_by(account_id=account_id))) == 1


def test_entry_gate_concurrent_first_visits_provision_exactly_one_user() -> None:
    """Two tabs opening at once both fire GET /auth/me for a brand-new account. The find-or-create
    is serialized under the engine lock, so the concurrent first visits must resolve to a single
    User row, not duplicates (the race the entry gate would have without the lock).
    """
    from concurrent.futures import ThreadPoolExecutor

    client = _client()
    account_id = make_account("visitor")
    authenticate(client, account_id)

    with ThreadPoolExecutor(max_workers=8) as pool:
        statuses = list(pool.map(lambda _: client.get(ME_URL).status_code, range(8)))

    assert statuses == [200] * 8
    assert len(list(User.filter_by(account_id=account_id))) == 1
