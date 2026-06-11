"""Unit tests for the server-wide accounts SQLite identity store."""

from __future__ import annotations

from pathlib import Path

import pytest

from energetica import accounts


@pytest.fixture
def accounts_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point the accounts module at a per-test SQLite file and initialise the schema."""
    db_path = tmp_path / "accounts.db"
    monkeypatch.setenv("ENERGETICA_ACCOUNTS_DB_PATH", str(db_path))
    accounts.init_db()
    return db_path


def test_create_and_lookup_account(accounts_db: Path) -> None:
    """create_account returns a positive account_id; get_account_by_username reads it back."""
    account_id = accounts.create_account(username="alice", pwhash="hash-of-secret")

    assert account_id > 0

    account = accounts.get_account_by_username("alice")
    assert account is not None
    assert account.account_id == account_id
    assert account.username == "alice"
    assert account.pwhash == "hash-of-secret"


def test_duplicate_username_raises_typed_error(accounts_db: Path) -> None:
    """A second create_account with the same username raises UsernameTakenError, not sqlite3.IntegrityError."""
    accounts.create_account(username="alice", pwhash="hash-1")

    with pytest.raises(accounts.UsernameTakenError):
        accounts.create_account(username="alice", pwhash="hash-2")


def test_verify_password_correct(accounts_db: Path) -> None:
    from energetica.utils.auth import generate_password_hash

    accounts.create_account(username="alice", pwhash=generate_password_hash("s3cret"))

    assert accounts.verify_password(username="alice", password="s3cret") is True


def test_verify_password_wrong(accounts_db: Path) -> None:
    from energetica.utils.auth import generate_password_hash

    accounts.create_account(username="alice", pwhash=generate_password_hash("s3cret"))

    assert accounts.verify_password(username="alice", password="not-the-password") is False


def test_verify_password_unknown_user(accounts_db: Path) -> None:
    assert accounts.verify_password(username="ghost", password="anything") is False


def test_update_password_changes_stored_hash(accounts_db: Path) -> None:
    """After update_password, the old password no longer verifies; the new one does."""
    from energetica.utils.auth import generate_password_hash

    accounts.create_account(username="alice", pwhash=generate_password_hash("old-pw"))

    accounts.update_password(username="alice", new_pwhash=generate_password_hash("new-pw"))

    assert accounts.verify_password(username="alice", password="old-pw") is False
    assert accounts.verify_password(username="alice", password="new-pw") is True
