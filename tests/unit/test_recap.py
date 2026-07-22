"""Unit tests for the recap: schema projection (G1), publish/load primitives, and the mint hook (T5).

The recap is a frozen JSON tombstone minted at ``active → freeze`` and published to the landing dir.
These tests exercise it without a running engine: the schema projection takes plain player stand-ins
(it reads by attribute), and the mint path is driven by monkeypatching ``Player.all`` + the config.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import pytest

from energetica import instance_config
from energetica.enums import Fuel, Renewable
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
    produced_co2: float
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

    def calculate_produced_co2(self) -> float:
        return self.produced_co2

    def calculate_net_emissions(self) -> float:
        return self.net_emissions


# --- lightweight tile stand-ins (utils._freeze_tiles reads the ORM shape by attribute) ---------


@dataclass
class _FakeTileOwner:
    """The narrow ``tile.player`` slice _freeze_tiles resolves — just ``.user.account_id``."""

    account_id: int

    @property
    def user(self) -> _FakeUser:
        return _FakeUser(account_id=self.account_id)


@dataclass
class _FakeTile:
    """A HexTile stand-in: coordinates, enum-keyed terrain dicts, and an optional settling owner."""

    q: int
    r: int
    owner_account_id: int | None = None
    solar: float = 1.0
    wind: float = 2.0
    hydro: float = 3.0
    coal: float = 4.0
    gas: float = 5.0
    uranium: float = 6.0
    climate_risk: float = 0.5

    @property
    def coordinates(self) -> tuple[int, int]:
        return (self.q, self.r)

    @property
    def potentials(self) -> dict[Renewable, float]:
        return {Renewable.SOLAR: self.solar, Renewable.WIND: self.wind, Renewable.HYDRO: self.hydro}

    @property
    def fuel_reserves(self) -> dict[Fuel, float]:
        return {Fuel.COAL: self.coal, Fuel.GAS: self.gas, Fuel.URANIUM: self.uranium}

    @property
    def player(self) -> _FakeTileOwner | None:
        return _FakeTileOwner(account_id=self.owner_account_id) if self.owner_account_id is not None else None


def _tiles() -> list[_FakeTile]:
    """Two settled tiles (owned by bob/carol) and one unsettled — deliberately out of (q, r) order."""
    return [
        _FakeTile(q=1, r=0, owner_account_id=30),  # carol
        _FakeTile(q=0, r=0, owner_account_id=20),  # bob
        _FakeTile(q=0, r=1, owner_account_id=None),  # unsettled
    ]


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
        _FakePlayer(
            account_id=10,
            _username="alice",
            operating_income=500,
            xp=42,
            captured_co2=100,
            produced_co2=95,  # net = 95 - 100 = -5
            net_emissions=-5,
        ),
        _FakePlayer(
            account_id=20,
            _username="bob",
            operating_income=1500,
            xp=99,
            captured_co2=250,
            produced_co2=280,  # net = 280 - 250 = 30
            net_emissions=30,
            network_name="Grid Co",
        ),
        _FakePlayer(
            account_id=30,
            _username="carol",
            operating_income=900,
            xp=70,
            captured_co2=0,
            produced_co2=12,  # net = 12 - 0 = 12
            net_emissions=12,
        ),
    ]


# --- Recap.from_players (schema projection, G1) ------------------------------------------------


def test_from_players_orders_by_operating_income_desc() -> None:
    """Default order is operating_income descending — 'most consequential first', not a ranking
    (ADR-0005). No row carries a rank/medal.
    """
    recap = Recap.from_players(slug=SLUG, config=_config(), players=_players())

    assert [row.username_at_freeze for row in recap.rows] == ["bob", "carol", "alice"]


def test_from_players_has_no_rank_field() -> None:
    """The recap crowns no winner: there is no global rank on a row (ADR-0005)."""
    recap = Recap.from_players(slug=SLUG, config=_config(), players=_players())

    assert "rank" not in recap.rows[0].model_dump()


def test_from_players_ties_break_on_account_id_reproducibly() -> None:
    """Equal-income players rank by ascending account_id, so a re-mint is a reproducible photograph
    regardless of the order Player.all() enumerates them in.
    """
    tied = [
        _FakePlayer(
            account_id=30,
            _username="carol",
            operating_income=100,
            xp=0,
            captured_co2=0,
            produced_co2=0,
            net_emissions=0,
        ),
        _FakePlayer(
            account_id=10,
            _username="alice",
            operating_income=100,
            xp=0,
            captured_co2=0,
            produced_co2=0,
            net_emissions=0,
        ),
        _FakePlayer(
            account_id=20, _username="bob", operating_income=100, xp=0, captured_co2=0, produced_co2=0, net_emissions=0
        ),
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
    # CO2 laid bare as two un-netted columns — produced and captured, not collapsed (ADR-0005).
    assert winner.produced_co2 == 280
    assert winner.captured_co2 == 250


def test_from_players_network_is_none_when_unaffiliated() -> None:
    recap = Recap.from_players(slug=SLUG, config=_config(), players=_players())

    assert recap.rows[2].network_name is None  # alice, no network


def test_from_players_totals_header() -> None:
    recap = Recap.from_players(slug=SLUG, config=_config(), players=_players())

    assert recap.player_count == 3
    assert recap.total_produced_co2 == 387  # 95 + 280 + 12
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
    assert recap.total_produced_co2 == 0
    assert recap.total_captured_co2 == 0
    assert recap.total_net_emissions == 0
    assert recap.tiles == []  # no tiles passed → empty snapshot (only from_players' test-only default)


# --- _freeze_tiles (map-snapshot projection, G1 addendum) --------------------------------------


def test_freeze_tiles_projects_terrain_and_resolves_ownership(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(recap_util.HexTile, "all", classmethod(lambda cls: _tiles()))

    tiles = recap_util._freeze_tiles()
    settled = next(tile for tile in tiles if tile.q == 0 and tile.r == 0)

    assert settled.owner_account_id == 20  # bob's tile → durable account FK, not the live player_id
    assert (settled.solar, settled.wind, settled.hydro) == (1.0, 2.0, 3.0)
    assert (settled.coal, settled.gas, settled.uranium) == (4.0, 5.0, 6.0)
    assert settled.climate_risk == 0.5


def test_freeze_tiles_unsettled_owner_is_none(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(recap_util.HexTile, "all", classmethod(lambda cls: _tiles()))

    unsettled = next(tile for tile in recap_util._freeze_tiles() if tile.owner_account_id is None)

    assert (unsettled.q, unsettled.r) == (0, 1)


def test_freeze_tiles_sorted_for_reproducibility(monkeypatch: pytest.MonkeyPatch) -> None:
    """Tiles are ordered by (q, r) regardless of HexTile.all()'s enumeration, so a re-mint matches."""
    monkeypatch.setattr(recap_util.HexTile, "all", classmethod(lambda cls: _tiles()))

    coords = [(tile.q, tile.r) for tile in recap_util._freeze_tiles()]

    assert coords == [(0, 0), (0, 1), (1, 0)]  # input was (1,0), (0,0), (0,1)


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
    monkeypatch.setattr(recap_util.HexTile, "all", classmethod(lambda cls: _tiles()))
    return config_dir


def test_mint_recap_publishes(configured: Path) -> None:
    recap_util.mint_recap()

    loaded = instance_config.load_recap(SLUG)
    assert loaded is not None
    assert loaded.player_count == 3
    assert loaded.rows[0].username_at_freeze == "bob"
    # The map snapshot is frozen alongside the leaderboard and survives the full JSON round-trip.
    assert [(tile.q, tile.r) for tile in loaded.tiles] == [(0, 0), (0, 1), (1, 0)]
    assert {tile.owner_account_id for tile in loaded.tiles} == {20, 30, None}


def test_mint_recap_remigrates_pre_addendum_recap(configured: Path) -> None:
    """A pre-addendum recap on disk lacks the ``tiles`` key, so it fails to load and is re-minted
    with the map snapshot — the schema bump self-heals through the same mint-once guard as a corrupt
    file, rather than stranding the lobby with a tile-less tombstone.
    """
    stale = Recap.from_players(slug=SLUG, config=_config(), players=_players()).model_dump(mode="json")
    del stale["tiles"]
    path = instance_config.recap_path(SLUG)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(stale), encoding="utf-8")

    assert instance_config.load_recap(SLUG) is None  # missing required key → unreadable → re-mint

    recap_util.mint_recap_if_needed()

    healed = instance_config.load_recap(SLUG)
    assert healed is not None
    assert len(healed.tiles) == 3  # re-minted with the frozen map snapshot


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
                    account_id=99,
                    _username="latecomer",
                    operating_income=9999,
                    xp=0,
                    captured_co2=0,
                    produced_co2=0,
                    net_emissions=0,
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
