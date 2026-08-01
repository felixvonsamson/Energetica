"""Unit tests for deployed-version reporting (``energetica.utils.version``).

These exercise the read logic that ``/healthz`` relies on: the deploy stamp is preferred, a
missing or corrupt stamp falls back to git, and each half is read independently. They patch the
module's resolved paths rather than touching a real checkout, so they are deterministic.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from energetica.utils import version


def test_backend_version_prefers_stamp(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    stamp = tmp_path / "DEPLOYED_VERSION.json"
    stamp.write_text('{"commit": "abc123", "commit_short": "abc123", "source": "deploy"}')
    monkeypatch.setattr(version, "_BACKEND_STAMP", stamp)
    # If the stamp is read, the git fallback must never run.
    monkeypatch.setattr(version, "_git_fallback", lambda: pytest.fail("git fallback should not run"))

    assert version.backend_version() == {"commit": "abc123", "commit_short": "abc123", "source": "deploy"}


def test_backend_version_falls_back_to_git_when_no_stamp(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(version, "_BACKEND_STAMP", tmp_path / "missing.json")
    monkeypatch.setattr(version, "_git_fallback", lambda: {"commit": "deadbeef", "source": "git"})

    assert version.backend_version() == {"commit": "deadbeef", "source": "git"}


def test_backend_version_falls_back_on_corrupt_stamp(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    stamp = tmp_path / "DEPLOYED_VERSION.json"
    stamp.write_text("not json {{{")
    monkeypatch.setattr(version, "_BACKEND_STAMP", stamp)
    monkeypatch.setattr(version, "_git_fallback", lambda: {"source": "git"})

    assert version.backend_version() == {"source": "git"}


def test_backend_version_is_none_when_nothing_available(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(version, "_BACKEND_STAMP", tmp_path / "missing.json")
    monkeypatch.setattr(version, "_git_fallback", lambda: None)

    assert version.backend_version() is None


def test_frontend_version_reads_bundle_stamp(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    bundle = tmp_path / "dist-lobby"
    bundle.mkdir()
    (bundle / "build-info.json").write_text('{"commit_short": "feed0000", "source": "build"}')
    monkeypatch.setattr(version, "REPO_ROOT", tmp_path)

    assert version.frontend_version("dist-lobby") == {"commit_short": "feed0000", "source": "build"}


def test_frontend_version_is_none_when_bundle_unstamped(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(version, "REPO_ROOT", tmp_path)

    assert version.frontend_version("dist-lobby") is None
