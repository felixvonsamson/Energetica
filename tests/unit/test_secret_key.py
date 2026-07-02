"""Unit tests for cookie-signing secret resolution.

Phase A of the lobby introduces a *server-wide* shared secret so every instance can validate a
session minted elsewhere. The instance prefers the shared secret when present, else falls back to
its own per-instance secret (the pre-lobby behaviour). The cookie *scope* is deliberately not
flipped yet — this only teaches the loader where to read the key.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from energetica.utils.auth import get_or_create_secret_key


@pytest.fixture(autouse=True)
def _secret_paths(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[Path, Path]:
    """Redirect both secret paths at per-test files so the repo working tree is never touched."""
    shared = tmp_path / "var" / "secret_key.txt"
    instance = tmp_path / "instance" / "secret_key.txt"
    instance.parent.mkdir(parents=True)
    monkeypatch.setenv("ENERGETICA_SHARED_SECRET_PATH", str(shared))
    monkeypatch.setenv("ENERGETICA_INSTANCE_SECRET_PATH", str(instance))
    return shared, instance


def test_prefers_shared_secret_when_present(_secret_paths: tuple[Path, Path]) -> None:
    shared, instance = _secret_paths
    shared.parent.mkdir(parents=True)
    shared.write_text("shared-server-wide-secret", encoding="utf-8")

    assert get_or_create_secret_key() == "shared-server-wide-secret"
    # The shared secret is provisioned by infra; the instance must not create its own.
    assert not instance.exists()


def test_falls_back_to_instance_secret_when_shared_absent(_secret_paths: tuple[Path, Path]) -> None:
    shared, instance = _secret_paths
    instance.write_text("per-instance-secret", encoding="utf-8")

    assert get_or_create_secret_key() == "per-instance-secret"


def test_creates_instance_secret_when_neither_exists(_secret_paths: tuple[Path, Path]) -> None:
    """Pre-lobby behaviour is preserved: with no shared secret, the instance mints its own. It must
    never create the shared file — that belongs to setup-base.sh.
    """
    shared, instance = _secret_paths

    key = get_or_create_secret_key()

    assert key
    assert instance.read_text(encoding="utf-8").strip() == key
    assert not shared.exists()
