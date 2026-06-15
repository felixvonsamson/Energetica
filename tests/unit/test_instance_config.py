"""Unit tests for per-instance visibility & access policy (``energetica.instance_config``)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from energetica import instance_config
from energetica.instance_config import InstanceConfig, InstanceConfigError, PrivateAccess, PublicAccess

SLUG = "autumn-2025"


@pytest.fixture
def configured(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point the module at per-test config + landing dirs and return the config dir."""
    config_dir = tmp_path / "etc"
    landing_dir = tmp_path / "landing"
    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", SLUG)
    monkeypatch.setenv("ENERGETICA_INSTANCE_CONFIG_DIR", str(config_dir))
    monkeypatch.setenv("ENERGETICA_LANDING_DIR", str(landing_dir))
    return config_dir


def _write_instance_json(config_dir: Path, payload: dict | str) -> None:
    target = config_dir / SLUG / "instance.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(payload if isinstance(payload, str) else json.dumps(payload), encoding="utf-8")


PUBLIC_JSON = {
    "name": "Autumn 2025",
    "advertised": True,
    "starts_at": "2025-09-15T00:00:00Z",
    "access": {"policy": "public"},
}
PRIVATE_JSON = {
    "name": "ETHZ Spring 2026",
    "advertised": False,
    "starts_at": "2026-03-01T00:00:00Z",
    "access": {"policy": "private", "allowed_usernames": ["alice", "bob"]},
}


# --- load_instance_config -------------------------------------------------------------------


def test_load_returns_none_when_slug_unset(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENERGETICA_INSTANCE_SLUG", raising=False)
    monkeypatch.setenv("ENERGETICA_INSTANCE_CONFIG_DIR", str(tmp_path))
    assert instance_config.load_instance_config() is None


def test_load_returns_none_when_file_absent(configured: Path) -> None:
    """An unconfigured-but-slugged instance reads as None → callers treat it as public."""
    assert instance_config.load_instance_config() is None


def test_load_valid_public(configured: Path) -> None:
    _write_instance_json(configured, PUBLIC_JSON)

    config = instance_config.load_instance_config()

    assert config is not None
    assert isinstance(config.access, PublicAccess)
    assert config.name == "Autumn 2025"
    assert config.advertised is True


def test_load_valid_private(configured: Path) -> None:
    _write_instance_json(configured, PRIVATE_JSON)

    config = instance_config.load_instance_config()

    assert config is not None
    assert isinstance(config.access, PrivateAccess)
    assert config.access.allowed_usernames == ["alice", "bob"]


def test_load_corrupt_file_fails_closed(configured: Path) -> None:
    """A present-but-broken policy file must raise (fail closed), never default to public."""
    _write_instance_json(configured, "{ not valid json")

    with pytest.raises(InstanceConfigError):
        instance_config.load_instance_config()


def test_load_unknown_policy_fails_closed(configured: Path) -> None:
    _write_instance_json(configured, {**PUBLIC_JSON, "access": {"policy": "everyone"}})

    with pytest.raises(InstanceConfigError):
        instance_config.load_instance_config()


def test_load_extra_key_fails_closed(configured: Path) -> None:
    """An unexpected top-level key fails closed rather than being silently ignored."""
    _write_instance_json(configured, {**PUBLIC_JSON, "allowed_usernames": ["sneaky"]})

    with pytest.raises(InstanceConfigError):
        instance_config.load_instance_config()


def test_load_public_policy_with_allowlist_key_fails_closed(configured: Path) -> None:
    """A half-edited config (policy still "public" but an allowlist key present) must not parse as
    world-open — the stray key inside the access block fails closed.
    """
    _write_instance_json(configured, {**PUBLIC_JSON, "access": {"policy": "public", "allowed_usernames": ["alice"]}})

    with pytest.raises(InstanceConfigError):
        instance_config.load_instance_config()


def test_load_naive_starts_at_fails_closed(configured: Path) -> None:
    """A timezone-naive starts_at is rejected (fail closed), so fragments are always tz-aware and
    the aggregation sort can never mix naive/aware datetimes.
    """
    _write_instance_json(configured, {**PUBLIC_JSON, "starts_at": "2025-09-15T00:00:00"})

    with pytest.raises(InstanceConfigError):
        instance_config.load_instance_config()


# --- is_access_allowed ----------------------------------------------------------------------


def test_public_allows_anyone() -> None:
    config = InstanceConfig.model_validate(PUBLIC_JSON)
    assert instance_config.is_access_allowed(config, "anyone") is True


def test_private_allows_listed_username() -> None:
    config = InstanceConfig.model_validate(PRIVATE_JSON)
    assert instance_config.is_access_allowed(config, "alice") is True


def test_private_denies_unlisted_username() -> None:
    config = InstanceConfig.model_validate(PRIVATE_JSON)
    assert instance_config.is_access_allowed(config, "carol") is False


def test_private_empty_allowlist_denies_everyone() -> None:
    """A private instance whose allowlist is empty (or omitted) locks everyone out — the highest-risk
    fail-open spot, so it is asserted explicitly.
    """
    config = InstanceConfig.model_validate({**PRIVATE_JSON, "access": {"policy": "private"}})
    assert config.access.allowed_usernames == []  # type: ignore[union-attr]
    assert instance_config.is_access_allowed(config, "alice") is False


# --- publish + aggregate --------------------------------------------------------------------


def test_publish_strips_access_block(configured: Path) -> None:
    """The fragment written to the landing dir must never carry the allowlist."""
    config = InstanceConfig.model_validate(PRIVATE_JSON)

    instance_config.publish(config)

    fragment_path = Path(configured).parent / "landing" / "instances" / f"{SLUG}.json"
    fragment = json.loads(fragment_path.read_text())
    assert "access" not in fragment
    assert "allowed_usernames" not in json.dumps(fragment)
    assert fragment == {
        "slug": SLUG,
        "name": "ETHZ Spring 2026",
        "advertised": False,
        "starts_at": fragment["starts_at"],
    }


def test_publish_aggregates_sorted_by_starts_at_desc(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """instances.json lists fragments most-recent-first, regardless of write order."""
    landing_dir = tmp_path / "landing"
    monkeypatch.setenv("ENERGETICA_INSTANCE_CONFIG_DIR", str(tmp_path / "etc"))
    monkeypatch.setenv("ENERGETICA_LANDING_DIR", str(landing_dir))

    # Publish an older instance first, then a newer one — aggregation must still order desc.
    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", "spring-2025")
    instance_config.publish(
        InstanceConfig.model_validate(
            {
                "name": "Spring 2025",
                "advertised": True,
                "starts_at": "2025-03-01T00:00:00Z",
                "access": {"policy": "public"},
            }
        )
    )
    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", "autumn-2025")
    instance_config.publish(
        InstanceConfig.model_validate(
            {
                "name": "Autumn 2025",
                "advertised": True,
                "starts_at": "2025-09-15T00:00:00Z",
                "access": {"policy": "public"},
            }
        )
    )

    manifest = json.loads((landing_dir / "instances.json").read_text())
    slugs = [entry["slug"] for entry in manifest["instances"]]
    assert slugs == ["autumn-2025", "spring-2025"]


def test_publish_noop_when_slug_unset(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENERGETICA_INSTANCE_SLUG", raising=False)
    monkeypatch.setenv("ENERGETICA_LANDING_DIR", str(tmp_path / "landing"))

    instance_config.publish(InstanceConfig.model_validate(PUBLIC_JSON))

    assert not (tmp_path / "landing").exists()
