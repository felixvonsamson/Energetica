"""Signed-session and credential primitives, free of any game-model dependency.

These are the low-level pieces of authentication — cookie-signing secret resolution, the
``itsdangerous`` serializer, password hashing, and the session-cookie read/write helpers — with
**no import of ``User``/``Player`` or the game engine**. That is deliberate: the server-wide
identity layer (``energetica.accounts``) and the instance-independent lobby service both import
from here, so this module must stay a leaf (see ADR-0002, lobby Phase B).

``energetica.utils.auth`` re-exports everything here and adds the ``User``/``Player``-coupled
request dependencies (``get_user`` & friends); game-side callers keep importing from ``auth`` and
see no change.

The cookie payload is a bare *identity string* chosen by the caller — the game side signs a
``username`` (pre-cutover), the lobby signs a ``str(account_id)``. This module neither knows nor
cares which; interpretation happens where the token is decoded.
"""

from __future__ import annotations

import os
import secrets
from datetime import timedelta

import bcrypt
import requests
from fastapi import Request, Response
from itsdangerous import URLSafeTimedSerializer


def get_or_create_secret_key() -> str:
    """Load the cookie-signing SECRET_KEY, preferring the server-wide shared secret.

    Resolution order (lobby Phase A — shared-secret *support*, cookie scope unchanged):

    1. The server-wide shared secret ``/var/lib/energetica/secret_key.txt`` if present. It is
       provisioned by ``setup-base.sh`` and shared across every instance so a session minted by
       the lobby validates everywhere. Read-only here — the instance never creates it.
    2. Otherwise the per-instance ``instance/secret_key.txt`` (the pre-lobby behaviour),
       creating it on first run.

    Both paths are env-overridable for tests. An existing-but-empty file fails loud rather than
    signing cookies with a zero-entropy key (which ``URLSafeTimedSerializer`` would accept) — a
    truncated write or a cleared file must not silently make every session cookie forgeable.
    """
    shared_path = os.environ.get("ENERGETICA_SHARED_SECRET_PATH", "/var/lib/energetica/secret_key.txt")
    if os.path.exists(shared_path):
        return _read_nonempty_secret(shared_path)

    instance_path = os.environ.get("ENERGETICA_INSTANCE_SECRET_PATH", "instance/secret_key.txt")
    if os.path.exists(instance_path):
        return _read_nonempty_secret(instance_path)

    secret_key = secrets.token_hex()
    with open(instance_path, "w", encoding="utf-8") as f:
        f.write(secret_key)
    return secret_key


def _read_nonempty_secret(path: str) -> str:
    """Read a secret-key file, raising if it exists but is empty (guessable zero-entropy key)."""
    with open(path, "r", encoding="utf-8") as f:
        key = f.read().strip()
    if not key:
        raise RuntimeError(f"secret key file at {path} is empty — refusing to sign cookies with an empty key")
    return key


SECRET_KEY = get_or_create_secret_key()
serializer = URLSafeTimedSerializer(SECRET_KEY)


def generate_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode(), salt)
    return hashed.decode()


def check_password_hash(*, plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


COOKIE_MAX_AGE = int(timedelta(days=60).total_seconds())  # NOTE: could be a command line argument in the future


def decode_session_token(token: str) -> str | None:
    """Return the identity string a valid, unexpired session token carries, else ``None``.

    Callers interpret the returned string themselves (``username`` game-side today,
    ``str(account_id)`` lobby-side). Any tampering, bad signature, or expiry reads as ``None``.
    """
    try:
        return serializer.loads(token, max_age=COOKIE_MAX_AGE)
    except Exception:
        return None


def add_session_cookie_to_response(
    response: Response, identity: str, request: Request, *, domain: str | None = None
) -> Response:
    """Sign ``identity`` into the ``session`` cookie on ``response``.

    ``identity`` is whatever the caller wants the session to carry (a ``username`` or a
    ``str(account_id)``). ``Secure`` is set when the reverse proxy reports HTTPS. ``domain`` scopes
    the cookie: the instance leaves it ``None`` (host-only), the lobby passes ``.{apex}`` so one
    session spans every run subdomain (ADR-0002).
    """
    token = serializer.dumps(identity)
    # Check if behind reverse proxy with HTTPS
    is_https = request.headers.get("X-Forwarded-Proto") == "https"
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        secure=is_https,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        domain=domain,
    )
    return response


def add_session_cookie_to_session(session: requests.Session, identity: str) -> requests.Session:
    token = serializer.dumps(identity)
    session.cookies.set(
        name="session",
        value=token,
        path="/",
        secure=False,
        rest={"HttpOnly": True, "SameSite": "Lax"},
    )
    return session
