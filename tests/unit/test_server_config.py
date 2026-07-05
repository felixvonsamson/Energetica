"""Unit tests for the server-wide config read by the lobby (``server.json``).

Carries the server-wide signup toggle (ADR-0003) — the analog of the per-instance
``disable_signups`` the lobby can't reuse. Read fresh on every call and **fail-closed**: a missing
or malformed file disables signups rather than risk throwing open account creation.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from energetica import server_config


@pytest.fixture
def config_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    path = tmp_path / "server.json"
    monkeypatch.setenv("ENERGETICA_SERVER_CONFIG_PATH", str(path))
    return path


def test_signups_enabled_true(config_path: Path) -> None:
    config_path.write_text('{"signups_enabled": true}', encoding="utf-8")
    assert server_config.signups_enabled() is True


def test_signups_enabled_false(config_path: Path) -> None:
    config_path.write_text('{"signups_enabled": false}', encoding="utf-8")
    assert server_config.signups_enabled() is False


def test_missing_file_fails_closed(config_path: Path) -> None:
    # File never written.
    assert server_config.signups_enabled() is False


def test_malformed_json_fails_closed(config_path: Path) -> None:
    config_path.write_text("{not valid json", encoding="utf-8")
    assert server_config.signups_enabled() is False


def test_unexpected_key_fails_closed(config_path: Path) -> None:
    """A config whose shape we don't recognise fails closed rather than guessing."""
    config_path.write_text('{"signups_enabled": true, "unexpected": 1}', encoding="utf-8")
    assert server_config.signups_enabled() is False


def test_wrong_type_fails_closed(config_path: Path) -> None:
    config_path.write_text('{"signups_enabled": "yes"}', encoding="utf-8")
    assert server_config.signups_enabled() is False


def test_read_fresh_each_call(config_path: Path) -> None:
    """No cache: an admin edit takes effect on the next call with no restart."""
    config_path.write_text('{"signups_enabled": false}', encoding="utf-8")
    assert server_config.signups_enabled() is False
    config_path.write_text('{"signups_enabled": true}', encoding="utf-8")
    assert server_config.signups_enabled() is True
