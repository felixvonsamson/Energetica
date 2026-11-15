"""
The session-signing secret, password hashing, and minting and decoding session tokens.

Only the lobby service imports this module (ADR-0009). Importing it loads the signing secret, so
nothing else may: runs and the lobby backend hand the session cookie to the service instead, and
set the cookie through :mod:`energetica.kernel.session_cookie`.

The token payload is the immutable ``str(account_id)`` (ADR-0002 amendment). This module signs and
decodes the bare string; :func:`account_id_from_token` reads the ``account_id`` back out of it.
"""

from __future__ import annotations

import os
import secrets

import bcrypt
from itsdangerous import URLSafeTimedSerializer

from energetica.kernel.session_cookie import COOKIE_MAX_AGE


def get_or_create_secret_key() -> str:
    """Load the cookie-signing SECRET_KEY, preferring the server-wide secret.

    Resolution order:

    1. The server-wide secret ``/var/lib/energetica-lobby-service/secret_key.txt`` if present.
       ``setup-base.sh`` provisions it, readable by the lobby service's Unix user only. This
       module never creates it.
    2. Otherwise a local ``instance/secret_key.txt``, created on first use. Local development
       points the first path into ``.energetica-dev/`` instead (``scripts/lib/dev-env.sh``).

    Both paths are env-overridable for tests. An existing-but-empty file fails loud rather than
    signing cookies with a zero-entropy key (which ``URLSafeTimedSerializer`` would accept) — a
    truncated write or a cleared file must not silently make every session cookie forgeable.
    """
    server_path = os.environ.get("ENERGETICA_SHARED_SECRET_PATH", "/var/lib/energetica-lobby-service/secret_key.txt")
    if os.path.exists(server_path):
        return _read_nonempty_secret(server_path)

    instance_path = os.environ.get("ENERGETICA_INSTANCE_SECRET_PATH", "instance/secret_key.txt")
    if os.path.exists(instance_path):
        return _read_nonempty_secret(instance_path)

    secret_key = secrets.token_hex()
    os.makedirs(os.path.dirname(instance_path) or ".", exist_ok=True)
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


def mint_session_token(account_id: int) -> str:
    """Sign ``account_id`` into a session token, the value of the session cookie."""
    return serializer.dumps(str(account_id))


def decode_session_token(token: str) -> str | None:
    """Return the identity string a valid, unexpired session token carries, else ``None``.

    The payload is a ``str(account_id)``. Any tampering, bad signature, or expiry reads as
    ``None``.
    """
    try:
        return serializer.loads(token, max_age=COOKIE_MAX_AGE)
    except Exception:
        return None


def account_id_from_token(token: str) -> int | None:
    """The ``account_id`` a valid session token carries, or ``None`` if absent/invalid.

    A tampered, expired, or non-integer payload reads as ``None`` (never raises). The payload is
    the immutable ``account_id`` (ADR-0002 amendment).
    """
    payload = decode_session_token(token)
    if payload is None:
        return None
    try:
        return int(payload)
    except ValueError:
        return None
