"""Signed-session and credential primitives, free of any game-model dependency.

These are the low-level pieces of authentication — cookie-signing secret resolution, the
``itsdangerous`` serializer, password hashing, and minting and decoding session tokens — with
**no import of ``Player`` or the game engine**. That is deliberate: the server-wide identity
layer (``energetica.identity.accounts``) and the lobby service both import from here, so this
module must stay a leaf (see ADR-0002, lobby Phase B).

Importing this module loads the signing secret. The lobby backend must not hold it (ADR-0009), so
it sets the cookie through :mod:`energetica.kernel.session_cookie` instead.

Every caller, game side included, imports these primitives from here. The request dependencies
built on them live in ``energetica.identity.web`` (account and role checks) and
``energetica.utils.auth`` (the ``Player``-coupled ones); neither re-exports anything from this module.

The cookie payload is the immutable ``str(account_id)`` (ADR-0002 amendment): the lobby mints it
and every instance validates it with the shared secret and resolves it against ``accounts.db``
(role) and, for a settled player, its local ``Player`` (ADR-0004). This module signs/decodes the
bare string; interpretation happens where the token is decoded.
"""

from __future__ import annotations

import os
import secrets

import bcrypt
from itsdangerous import URLSafeTimedSerializer

# SESSION_COOKIE_NAME is re-exported: runs still import it from here.
from energetica.kernel.session_cookie import COOKIE_MAX_AGE, SESSION_COOKIE_NAME  # noqa: F401


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
    instance (``get_account_from_token``) and the lobby (``account_id_from_request``) so both decode
    the cookie identically (ADR-0002 amendment: the payload is the immutable ``account_id``).
    """
    payload = decode_session_token(token)
    if payload is None:
        return None
    try:
        return int(payload)
    except ValueError:
        return None
