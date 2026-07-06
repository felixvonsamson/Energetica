"""Signed-session and credential primitives, free of any game-model dependency.

These are the low-level pieces of authentication — cookie-signing secret resolution, the
``itsdangerous`` serializer, password hashing, and the session-cookie read/write helpers — with
**no import of ``User``/``Player`` or the game engine**. That is deliberate: the server-wide
identity layer (``energetica.accounts``) and the instance-independent lobby service both import
from here, so this module must stay a leaf (see ADR-0002, lobby Phase B).

``energetica.utils.auth`` re-exports everything here and adds the ``User``/``Player``-coupled
request dependencies (``get_user`` & friends); game-side callers keep importing from ``auth`` and
see no change.

The cookie payload is the immutable ``str(account_id)`` (ADR-0002 amendment): the lobby mints it
and every instance validates it with the shared secret and resolves it against its local ``User``.
This module signs/decodes the bare string; interpretation happens where the token is decoded.
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

# The single-sign-on session cookie is deliberately **not** named ``session``. Pre-cutover the
# instance minted a host-only ``session`` cookie signed with its per-instance secret; those legacy
# cookies linger in browsers for the cookie's whole ``max_age`` (60 days). Naming the shared SSO
# cookie distinctly means the post-cutover instance reads only this name and can never confuse a
# stale host-only ``session`` (which would fail to validate against the shared secret) with the
# valid ``.{apex}`` SSO cookie — RFC 6265 does not define which wins when two same-named cookies
# match a request, so a shared name risks a redirect loop for returning players (#817, ADR-0002).
SESSION_COOKIE_NAME = "energetica_session"


def generate_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode(), salt)
    return hashed.decode()


def check_password_hash(*, plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


COOKIE_MAX_AGE = int(timedelta(days=60).total_seconds())  # NOTE: could be a command line argument in the future


def decode_session_token(token: str) -> str | None:
    """Return the identity string a valid, unexpired session token carries, else ``None``.

    The payload is a ``str(account_id)`` both lobby- and (post-cutover) instance-side. Any
    tampering, bad signature, or expiry reads as ``None``.
    """
    try:
        return serializer.loads(token, max_age=COOKIE_MAX_AGE)
    except Exception:
        return None


def account_id_from_token(token: str) -> int | None:
    """The ``account_id`` a valid session token carries, or ``None`` if absent/invalid.

    A tampered, expired, or non-integer payload reads as ``None`` (never raises). Shared by the
    instance (``get_user_from_token``) and the lobby (``account_id_from_request``) so both decode
    the cookie identically (ADR-0002 amendment: the payload is the immutable ``account_id``).
    """
    payload = decode_session_token(token)
    if payload is None:
        return None
    try:
        return int(payload)
    except ValueError:
        return None


def add_session_cookie_to_response(
    response: Response, identity: str, request: Request, *, domain: str | None = None
) -> Response:
    """Sign ``identity`` into the SSO session cookie on ``response``.

    ``identity`` is the ``str(account_id)`` the session carries. ``Secure`` is set when the reverse
    proxy reports HTTPS. ``domain`` scopes
    the cookie: the instance leaves it ``None`` (host-only), the lobby passes ``.{apex}`` so one
    session spans every run subdomain (ADR-0002).
    """
    token = serializer.dumps(identity)
    # Check if behind reverse proxy with HTTPS
    is_https = request.headers.get("X-Forwarded-Proto") == "https"
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
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
        name=SESSION_COOKIE_NAME,
        value=token,
        path="/",
        secure=False,
        rest={"HttpOnly": True, "SameSite": "Lax"},
    )
    return session
