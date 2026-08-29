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


def test_get_account_by_id_roundtrip(accounts_db: Path) -> None:
    """get_account_by_id reads back the account created under that id (the lobby resolves the
    session cookie's account_id payload this way).
    """
    account_id = accounts.create_account(username="alice", pwhash="hash-of-secret")

    account = accounts.get_account_by_id(account_id)
    assert account is not None
    assert account.account_id == account_id
    assert account.username == "alice"


def test_get_account_by_id_unknown_returns_none(accounts_db: Path) -> None:
    assert accounts.get_account_by_id(999_999) is None


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


# --- search_accounts (#1022) --------------------------------------------------------------------
#
# Backs the facilitator roster's add control: looking up an existing account by username prefix
# so the facilitator can only add an account that actually exists (no freeform username strings).


def test_search_accounts_matches_by_prefix(accounts_db: Path) -> None:
    accounts.create_account(username="alice", pwhash="hash")
    accounts.create_account(username="alicia", pwhash="hash")
    accounts.create_account(username="bob", pwhash="hash")

    matches = accounts.search_accounts(prefix="ali")

    assert [account.username for account in matches] == ["alice", "alicia"]


def test_search_accounts_is_case_sensitive_like_the_rest_of_the_store(accounts_db: Path) -> None:
    """Matches ``get_account_by_username``'s exact-match convention: no case folding."""
    accounts.create_account(username="Alice", pwhash="hash")

    assert accounts.search_accounts(prefix="ali") == []
    assert [account.username for account in accounts.search_accounts(prefix="Ali")] == ["Alice"]


def test_search_accounts_no_match_returns_empty_list(accounts_db: Path) -> None:
    accounts.create_account(username="alice", pwhash="hash")

    assert accounts.search_accounts(prefix="zzz") == []


def test_search_accounts_treats_percent_and_underscore_as_literal(accounts_db: Path) -> None:
    """A prefix containing SQL ``LIKE`` wildcards must not match unrelated usernames."""
    accounts.create_account(username="a_b", pwhash="hash")
    accounts.create_account(username="axb", pwhash="hash")

    matches = accounts.search_accounts(prefix="a_")

    assert [account.username for account in matches] == ["a_b"]


def test_search_accounts_caps_results_at_limit(accounts_db: Path) -> None:
    for i in range(5):
        accounts.create_account(username=f"player{i}", pwhash="hash")

    matches = accounts.search_accounts(prefix="player", limit=3)

    assert len(matches) == 3
