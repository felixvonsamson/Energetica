"""Unit tests for the recap: schema projection (G1), publish/load primitives, and the mint hook (T5).

The recap is a frozen JSON tombstone minted at ``active → freeze`` and published to the landing dir.
These tests exercise it without a running engine: the schema projection takes plain player stand-ins
(it reads by attribute), and the mint path is driven by monkeypatching ``Player.all`` + the config.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import pytest

from energetica import instance_config
from energetica.instance_config import InstanceConfig, PublicAccess
from energetica.schemas.recap import Recap
from energetica.utils import recap as recap_util

SLUG = "autumn-2025"


# --- lightweight player stand-ins (the schema reads by attribute, so it needs no real ORM) ----


@dataclass
class _FakeUser:
    account_id: int


@dataclass
class _FakeNetwork:
    name: str


@dataclass
class _FakePlayer:
    account_id: int
    _username: str
    operating_income: float
    xp: float
    captured_co2: float
    net_emissions: float
    network_name: str | None = None

    @property
    def user(self) -> _FakeUser:
        return _FakeUser(account_id=self.account_id)

    @property
    def username(self) -> str:
        return self._username

    @property
    def network(self) -> _FakeNetwork | None:
        return _FakeNetwork(name=self.network_name) if self.network_name is not None else None

    @property
    def progression_metrics(self) -> dict[str, float]:
        return {"operating_income": self.operating_income, "xp": self.xp, "captured_co2": self.captured_co2}

    def calculate_net_emissions(self) -> float:
        return self.net_emissions


def _config() -> InstanceConfig:
    return InstanceConfig(
        name="Autumn 2025",
        advertised=True,
        starts_at=datetime(2025, 9, 15, tzinfo=timezone.utc),
        freeze_at=datetime(2025, 12, 1, tzinfo=timezone.utc),
        access=PublicAccess(policy="public"),
    )


def _players() -> list[_FakePlayer]:
    return [
        _FakePlayer(account_id=10, _username="alice", operating_income=500, xp=42, captured_co2=100, net_emissions=-5),
        _FakePlayer(
            account_id=20,
            _username="bob",
            operating_income=1500,
            xp=99,
            captured_co2=250,
            net_emissions=30,
            network_name="Grid Co",
        ),
        _FakePlayer(account_id=30, _username="carol", operating_income=900, xp=70, captured_co2=0, net_emissions=12),
    ]


# --- Recap.from_players (schema projection, G1) ------------------------------------------------


def test_from_players_ranks_by_operating_income_desc() -> None:
    recap = Recap.from_players(slug=SLUG, config=_config(), players=_players())

    assert [row.username_at_freeze for row in recap.rows] == ["bob", "carol", "alice"]
    assert [row.rank for row in recap.rows] == [1, 2, 3]


def test_from_players_ties_break_on_account_id_reproducibly() -> None:
    """Equal-income players rank by ascending account_id, so a re-mint is a reproducible photograph
    regardless of the order Player.all() enumerates them in.
    """
    tied = [
        _FakePlayer(account_id=30, _username="carol", operating_income=100, xp=0, captured_co2=0, net_emissions=0),
        _FakePlayer(account_id=10, _username="alice", operating_income=100, xp=0, captured_co2=0, net_emissions=0),
        _FakePlayer(account_id=20, _username="bob", operating_income=100, xp=0, captured_co2=0, net_emissions=0),
    ]
    forward = Recap.from_players(slug=SLUG, config=_config(), players=tied)
    reshuffled = Recap.from_players(slug=SLUG, config=_config(), players=list(reversed(tied)))

    assert [row.account_id for row in forward.rows] == [10, 20, 30]
    assert forward.rows == reshuffled.rows  # identical frozen photograph across enumeration order


def test_from_players_projects_the_curated_columns() -> None:
    recap = Recap.from_players(slug=SLUG, config=_config(), players=_players())
    winner = recap.rows[0]

    assert winner.account_id == 20  # FK retained for future identity resolution
    assert winner.username_at_freeze == "bob"
    assert winner.network_name == "Grid Co"
    assert winner.operating_income == 1500
    assert winner.xp == 99
    assert winner.captured_co2 == 250


def test_from_players_network_is_none_when_unaffiliated() -> None:
    recap = Recap.from_players(slug=SLUG, config=_config(), players=_players())

    assert recap.rows[2].network_name is None  # alice, no network


def test_from_players_totals_header() -> None:
    recap = Recap.from_players(slug=SLUG, config=_config(), players=_players())

    assert recap.player_count == 3
    assert recap.total_captured_co2 == 350  # 100 + 250 + 0
    assert recap.total_net_emissions == 37  # -5 + 30 + 12


def test_from_players_carries_identity_header() -> None:
    recap = Recap.from_players(slug=SLUG, config=_config(), players=_players())

    assert recap.slug == SLUG
    assert recap.name == "Autumn 2025"
    assert recap.starts_at == datetime(2025, 9, 15, tzinfo=timezone.utc)
    assert recap.freeze_at == datetime(2025, 12, 1, tzinfo=timezone.utc)
    assert recap.ended_at is None


def test_from_players_empty_instance() -> None:
    recap = Recap.from_players(slug=SLUG, config=_config(), players=[])

    assert recap.player_count == 0
    assert recap.rows == []
    assert recap.total_captured_co2 == 0
    assert recap.total_net_emissions == 0


# --- publish / load / exists primitives (instance_config) --------------------------------------


@pytest.fixture
def landing(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point the module at a per-test landing dir and set the slug."""
    landing_dir = tmp_path / "landing"
    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", SLUG)
    monkeypatch.setenv("ENERGETICA_LANDING_DIR", str(landing_dir))
    return landing_dir


def test_publish_then_load_round_trips(landing: Path) -> None:
    recap = Recap.from_players(slug=SLUG, config=_config(), players=_players())

    assert instance_config.recap_exists(SLUG) is False
    instance_config.publish_recap(recap)

    assert instance_config.recap_exists(SLUG) is True
    assert instance_config.recap_path(SLUG) == landing / "recaps" / f"{SLUG}.json"
    loaded = instance_config.load_recap(SLUG)
    assert loaded == recap


def test_publish_is_not_world_readable(landing: Path) -> None:
    """The atomic write mode is group-readable (0o640) but not world-readable — same as fragments."""
    recap = Recap.from_players(slug=SLUG, config=_config(), players=_players())
    instance_config.publish_recap(recap)

    mode = instance_config.recap_path(SLUG).stat().st_mode & 0o777
    assert mode == 0o640


def test_recap_is_not_aggregated_into_the_manifest(landing: Path) -> None:
    """A recap lives beside the fragment but is deliberately kept out of instances.json."""
    recap = Recap.from_players(slug=SLUG, config=_config(), players=_players())
    instance_config.publish_recap(recap)

    assert not (landing / "instances.json").exists()  # publish_recap doesn't aggregate


def test_load_recap_absent_is_none(landing: Path) -> None:
    assert instance_config.load_recap(SLUG) is None


def test_load_recap_corrupt_is_none(landing: Path) -> None:
    path = instance_config.recap_path(SLUG)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("{ not valid json", encoding="utf-8")

    assert instance_config.load_recap(SLUG) is None


# --- mint orchestration (utils.recap) ----------------------------------------------------------


@pytest.fixture
def configured(landing: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """On-disk instance.json alongside the landing dir, plus a patched Player.all."""
    config_dir = tmp_path / "etc"
    target = config_dir / SLUG / "instance.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(_config().model_dump_json(), encoding="utf-8")
    monkeypatch.setenv("ENERGETICA_INSTANCE_CONFIG_DIR", str(config_dir))
    monkeypatch.setattr(recap_util.Player, "all", classmethod(lambda cls: _players()))
    return config_dir


def test_mint_recap_publishes(configured: Path) -> None:
    recap_util.mint_recap()

    loaded = instance_config.load_recap(SLUG)
    assert loaded is not None
    assert loaded.player_count == 3
    assert loaded.rows[0].username_at_freeze == "bob"


def test_mint_recap_if_needed_is_mint_once(configured: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """The frozen photograph is taken once — a second call after the file exists is a no-op."""
    recap_util.mint_recap_if_needed()
    first = instance_config.load_recap(SLUG)
    assert first is not None

    # The state changes, but the already-minted recap must not be re-photographed.
    monkeypatch.setattr(
        recap_util.Player,
        "all",
        classmethod(
            lambda cls: [
                _FakePlayer(
                    account_id=99, _username="latecomer", operating_income=9999, xp=0, captured_co2=0, net_emissions=0
                )
            ]
        ),
    )
    recap_util.mint_recap_if_needed()

    assert instance_config.load_recap(SLUG) == first


def test_mint_recap_regenerates_after_delete(configured: Path) -> None:
    """Admin delete/regenerate: once the file is gone, the next mint-if-needed re-mints it."""
    recap_util.mint_recap_if_needed()
    instance_config.recap_path(SLUG).unlink()

    recap_util.mint_recap_if_needed()

    assert instance_config.recap_exists(SLUG) is True


def test_mint_recap_reheals_corrupt_file(configured: Path) -> None:
    """A malformed recap on disk self-heals: the load-based guard re-mints it rather than treating
    the corrupt file as 'already minted' and stranding the lobby with it.
    """
    path = instance_config.recap_path(SLUG)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("{ not valid json", encoding="utf-8")

    recap_util.mint_recap_if_needed()

    healed = instance_config.load_recap(SLUG)
    assert healed is not None
    assert healed.player_count == 3


def test_mint_recap_noop_when_unconfigured(landing: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """A dev/legacy instance with no slug mints nothing (no lifecycle to snapshot)."""
    monkeypatch.delenv("ENERGETICA_INSTANCE_SLUG", raising=False)

    assert recap_util.build_recap() is None
    recap_util.mint_recap_if_needed()  # must not raise


def test_mint_recap_if_needed_swallows_errors(configured: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """A mint failure is best-effort — it is logged and swallowed, never breaking the tick loop."""

    def _boom() -> Recap | None:
        raise RuntimeError("kaboom")

    monkeypatch.setattr(recap_util, "build_recap", _boom)

    recap_util.mint_recap_if_needed()  # does not raise
