"""The credentials file of a Workshop Run with teams (#1385): only the Run's process reads it, and it ends at its expiry."""

from __future__ import annotations

import stat
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from energetica.workshop.credentials import (
    CredentialLine,
    WorkshopCredentials,
    delete_expired_credentials,
    read_credentials,
    write_credentials,
)

NOW = datetime(2026, 3, 1, 12, 0, tzinfo=timezone.utc)
CREDENTIALS = WorkshopCredentials(
    expires_at=NOW + timedelta(days=7),
    accounts=[
        CredentialLine(team="Axpo", username="laufenbourg", password="k7mp3xq9rt"),
        CredentialLine(team="Romande Energie", username="romanel", password="b4nw8zd2hc"),
    ],
)


@pytest.fixture
def path(tmp_path: Path) -> Path:
    return tmp_path / "instance" / "workshop_credentials.json"


def test_written_credentials_read_back(path: Path) -> None:
    write_credentials(path, CREDENTIALS)

    assert read_credentials(path, now=NOW) == CREDENTIALS


def test_only_the_owner_can_read_the_file(path: Path) -> None:
    write_credentials(path, CREDENTIALS)

    assert stat.S_IMODE(path.stat().st_mode) == 0o600


def test_rewriting_keeps_the_file_owner_only(path: Path) -> None:
    path.parent.mkdir(parents=True)
    path.write_text("{}")
    path.chmod(0o644)

    write_credentials(path, CREDENTIALS)

    assert stat.S_IMODE(path.stat().st_mode) == 0o600


def test_a_run_without_the_file_has_no_credentials(path: Path) -> None:
    assert read_credentials(path, now=NOW) is None


def test_expired_credentials_are_deleted_rather_than_read(path: Path) -> None:
    write_credentials(path, CREDENTIALS)

    assert read_credentials(path, now=CREDENTIALS.expires_at) is None
    assert not path.exists()


def test_deleting_expired_credentials_keeps_current_ones(path: Path) -> None:
    write_credentials(path, CREDENTIALS)

    assert not delete_expired_credentials(path, now=NOW)
    assert path.exists()

    assert delete_expired_credentials(path, now=CREDENTIALS.expires_at + timedelta(seconds=1))
    assert not path.exists()


def test_deleting_when_there_is_no_file_does_nothing(path: Path) -> None:
    assert not delete_expired_credentials(path, now=NOW)
