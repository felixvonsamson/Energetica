"""Unit tests for the instance_membership backfill migration's core logic.

The backfill writes one membership row per already-settled Player across an instance's pickle, so
players who settled before instance_membership existed still appear under 'your runs'. Deploy
order (see docs/architecture/lobby.md § Phasing) requires this to run before the lobby serves
my-runs. The pickle I/O lives in main(); the row-writing logic is unit-tested here against
duck-typed players.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest

from energetica import accounts

_SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "backfill-instance-membership.py"


def _load_script() -> ModuleType:
    spec = importlib.util.spec_from_file_location("backfill_instance_membership", _SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _player(account_id: int, settled_iso: str) -> SimpleNamespace:
    """A duck-typed stand-in for a pickle Player: has .user.account_id and .created_at."""
    return SimpleNamespace(user=SimpleNamespace(account_id=account_id), created_at=_FakeDatetime(settled_iso))


class _FakeDatetime:
    def __init__(self, iso: str) -> None:
        self._iso = iso

    def isoformat(self) -> str:
        return self._iso


@pytest.fixture
def accounts_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    db_path = tmp_path / "accounts.db"
    monkeypatch.setenv("ENERGETICA_ACCOUNTS_DB_PATH", str(db_path))
    accounts.init_db()
    return db_path


def test_backfill_writes_one_membership_per_settled_player(accounts_db: Path) -> None:
    module = _load_script()
    players = [_player(1, "2026-03-01T00:00:00+00:00"), _player(2, "2026-03-02T00:00:00+00:00")]

    written = module.backfill_memberships(players, slug="spring-2026")

    assert written == 2
    assert accounts.get_memberships(account_id=1)[0].slug == "spring-2026"
    assert accounts.get_memberships(account_id=1)[0].settled_at == "2026-03-01T00:00:00+00:00"
    assert accounts.get_memberships(account_id=2)[0].slug == "spring-2026"


def test_backfill_is_idempotent(accounts_db: Path) -> None:
    module = _load_script()
    players = [_player(1, "2026-03-01T00:00:00+00:00")]

    module.backfill_memberships(players, slug="spring-2026")
    module.backfill_memberships(players, slug="spring-2026")

    assert len(accounts.get_memberships(account_id=1)) == 1
