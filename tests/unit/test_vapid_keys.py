"""Unit tests for VAPID keypair generation and persistence.

These pin the *encoding* of the two files in `instance/`, which is a contract with a third party:
the browser push service reads the public key, and `pywebpush` reads the private key back to sign
every notification. Getting either encoding wrong produces keys that look fine and fail only at
delivery time, against a remote server.

The push-delivery tests in `tests/integration/test_push_notifications.py` monkeypatch `webpush`,
so they exercise the dispatch path but never the real key format. These tests close that gap by
running the generated keys through `py_vapid` for real, via `Vapid.from_string` — the same entry
point `pywebpush` uses when it is handed a private key as a string.
"""

from __future__ import annotations

import base64
from collections.abc import Iterator
from pathlib import Path
from typing import cast

import pytest
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from py_vapid import Vapid

from energetica.game_engine import GameEngine
from energetica.utils.browser_notifications import load_or_create_vapid_keys


class _KeyHolder:
    """Stands in for the engine: `load_or_create_vapid_keys` only assigns these two attributes."""

    VAPID_PUBLIC_KEY: str
    VAPID_PRIVATE_KEY: str


def _engine() -> GameEngine:
    return cast(GameEngine, _KeyHolder())


@pytest.fixture(autouse=True)
def _instance_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    """The key paths are relative to the working directory, so run each test in its own."""
    instance = tmp_path / "instance"
    instance.mkdir()
    monkeypatch.chdir(tmp_path)
    yield instance


def _decode(key: str) -> bytes:
    """Undo the URL-safe, unpadded base64 the keys are stored in."""
    return base64.urlsafe_b64decode(key + "=" * (-len(key) % 4))


def test_generated_private_key_signs_a_vapid_jwt() -> None:
    """The end-to-end contract: pywebpush must be able to load the key and sign with it."""
    engine = _engine()
    load_or_create_vapid_keys(engine)

    vapid = Vapid.from_string(private_key=engine.VAPID_PRIVATE_KEY)
    headers = vapid.sign({"aud": "https://push.example.com", "sub": "mailto:energetica.game@gmail.com"})

    assert headers["Authorization"].startswith("vapid ")


def test_public_key_matches_the_private_key() -> None:
    """The browser is handed the public key and the push service checks it against our signature,
    so a public key that does not belong to the private key fails only at delivery time.
    """
    engine = _engine()
    load_or_create_vapid_keys(engine)

    vapid = Vapid.from_string(private_key=engine.VAPID_PRIVATE_KEY)
    assert vapid.public_key is not None, "py_vapid could not derive a public key from the private key"
    derived = vapid.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)

    assert derived == _decode(engine.VAPID_PUBLIC_KEY)


def test_keys_use_the_raw_encodings_vapid_requires() -> None:
    """VAPID wants the bare 32-byte private scalar and the uncompressed SEC1 public point."""
    engine = _engine()
    load_or_create_vapid_keys(engine)

    private_bytes = _decode(engine.VAPID_PRIVATE_KEY)
    public_bytes = _decode(engine.VAPID_PUBLIC_KEY)

    assert len(private_bytes) == 32
    assert len(public_bytes) == 65
    assert public_bytes[0] == 0x04  # uncompressed-point marker, followed by X and Y


def test_keys_are_stored_unpadded_and_url_safe() -> None:
    """Base64 padding or '+'/'/' would be rejected: the public key goes into a URL-safe JSON
    payload for the browser, and py_vapid parses the private key as unpadded urlsafe base64.
    """
    engine = _engine()
    load_or_create_vapid_keys(engine)

    for key in (engine.VAPID_PUBLIC_KEY, engine.VAPID_PRIVATE_KEY):
        assert "=" not in key
        assert "+" not in key
        assert "/" not in key


def test_existing_keys_are_reused(_instance_dir: Path) -> None:
    """Regenerating on restart would silently invalidate every stored push subscription."""
    first = _engine()
    load_or_create_vapid_keys(first)

    second = _engine()
    load_or_create_vapid_keys(second)

    assert (second.VAPID_PUBLIC_KEY, second.VAPID_PRIVATE_KEY) == (first.VAPID_PUBLIC_KEY, first.VAPID_PRIVATE_KEY)
    assert (_instance_dir / "vapid_public_key.txt").read_text(encoding="utf-8").strip() == first.VAPID_PUBLIC_KEY
    assert (_instance_dir / "vapid_private_key.txt").read_text(encoding="utf-8").strip() == first.VAPID_PRIVATE_KEY


def test_each_generation_produces_a_distinct_key() -> None:
    """Guards against a constant or seeded key sneaking in — these must be fresh random keys."""
    first = _engine()
    load_or_create_vapid_keys(first)

    Path("instance/vapid_public_key.txt").unlink()
    Path("instance/vapid_private_key.txt").unlink()

    second = _engine()
    load_or_create_vapid_keys(second)

    assert second.VAPID_PRIVATE_KEY != first.VAPID_PRIVATE_KEY
