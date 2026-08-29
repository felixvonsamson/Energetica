"""Unit tests for the allowed_usernames-to-accounts.db migration's core logic (#1030 follow-up).

The migration records a lobby-style join for every account.db account matching a private run's
deprecated instance.json allowlist, so an existing invitee keeps their access once the backend
stops reading that field (ADR-0006). The argparse/instance.json I/O lives in main(); the
write-and-skip logic is unit-tested here against accounts.db directly.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType

import pytest

from energetica import accounts

_SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "migrate-allowed-usernames.py"


def _load_script() -> ModuleType:
    spec = importlib.util.spec_from_file_location("migrate_allowed_usernames", _SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def accounts_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    db_path = tmp_path / "accounts.db"
    monkeypatch.setenv("ENERGETICA_ACCOUNTS_DB_PATH", str(db_path))
    accounts.init_db()
    return db_path


def test_migrate_records_a_join_for_each_matching_account(accounts_db: Path) -> None:
    module = _load_script()
    accounts.create_account(username="alice", pwhash="h")
    accounts.create_account(username="bob", pwhash="h")

    written, skipped = module.migrate(["alice", "bob"], slug="spring-2026")

    assert written == 2
    assert skipped == []
    assert accounts.has_joined(account_id=accounts.get_account_by_username("alice").account_id, slug="spring-2026")
    assert accounts.has_joined(account_id=accounts.get_account_by_username("bob").account_id, slug="spring-2026")


def test_migrate_skips_a_username_with_no_matching_account(accounts_db: Path) -> None:
    module = _load_script()
    accounts.create_account(username="alice", pwhash="h")

    written, skipped = module.migrate(["alice", "ghost"], slug="spring-2026")

    assert written == 1
    assert skipped == ["ghost"]


def test_migrate_is_idempotent(accounts_db: Path) -> None:
    module = _load_script()
    accounts.create_account(username="alice", pwhash="h")

    module.migrate(["alice"], slug="spring-2026")
    written, skipped = module.migrate(["alice"], slug="spring-2026")

    assert written == 1  # record_join is INSERT OR IGNORE; still "written" (a no-op write attempt)
    assert skipped == []
    account_id = accounts.get_account_by_username("alice").account_id
    assert len(accounts.get_memberships(account_id=account_id)) == 1


def test_migrate_dry_run_writes_nothing(accounts_db: Path) -> None:
    module = _load_script()
    account_id = accounts.create_account(username="alice", pwhash="h")

    written, skipped = module.migrate(["alice"], slug="spring-2026", dry_run=True)

    assert written == 1
    assert skipped == []
    assert accounts.has_joined(account_id=account_id, slug="spring-2026") is False


def test_migrate_skips_and_reports_a_conflicting_facilitator(accounts_db: Path) -> None:
    """An allowlisted username that has since become this run's facilitator is left alone rather
    than failing the whole migration over one pre-existing role conflict.
    """
    module = _load_script()
    account_id = accounts.create_account(username="prof", pwhash="h")
    accounts.grant_facilitator(account_id=account_id, slug="spring-2026")

    written, skipped = module.migrate(["prof"], slug="spring-2026")

    assert written == 0
    assert skipped == ["prof"]
    assert accounts.is_facilitator(account_id=account_id, slug="spring-2026") is True
