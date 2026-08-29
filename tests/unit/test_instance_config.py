"""Unit tests for per-instance visibility & access policy (``energetica.instance_config``)."""

from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path

import pytest

from energetica import instance_config
from energetica.instance_config import (
    InstanceConfig,
    InstanceConfigError,
    InstanceFragment,
    InstanceNotPrivateError,
    PrivateAccess,
    PublicAccess,
    derive_phase,
)

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
    "access": {"policy": "private"},
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


def test_load_private_with_the_removed_allowlist_key_fails_closed(configured: Path) -> None:
    """`allowed_usernames` is gone from PrivateAccess (#1031) — an instance.json still carrying it
    (from before that change, or a stray hand-edit) fails closed rather than silently parsing as
    if the key still had an effect.
    """
    _write_instance_json(configured, {**PRIVATE_JSON, "access": {"policy": "private", "allowed_usernames": ["alice"]}})

    with pytest.raises(InstanceConfigError):
        instance_config.load_instance_config()


def test_load_naive_starts_at_fails_closed(configured: Path) -> None:
    """A timezone-naive starts_at is rejected (fail closed), so fragments are always tz-aware and
    the aggregation sort can never mix naive/aware datetimes.
    """
    _write_instance_json(configured, {**PUBLIC_JSON, "starts_at": "2025-09-15T00:00:00"})

    with pytest.raises(InstanceConfigError):
        instance_config.load_instance_config()


# --- allowed_usernames is removed, not deprecated (#1031) -----------------------------------
#
# Who may access a private run lives in accounts.db (tests/unit/test_instance_membership.py:
# has_joined / record_join / remove_membership / get_run_roster). No private instance had ever
# been deployed with real allowlist data at the time of that migration, so the field was removed
# outright rather than kept around inert — see ADR-0007 and instance_config.PrivateAccess's
# docstring. test_load_private_with_the_removed_allowlist_key_fails_closed above covers the
# fail-closed behaviour for a file that still carries the key.


# --- join_token / join_open (#1019) -----------------------------------------------------------


def test_private_access_join_fields_default(configured: Path) -> None:
    """A config file written before #1019 (neither field present) still loads, with the new fields
    defaulting to "no join link yet".
    """
    _write_instance_json(configured, PRIVATE_JSON)

    config = instance_config.load_instance_config()

    assert config is not None
    assert isinstance(config.access, PrivateAccess)
    assert config.access.join_token is None
    assert config.access.join_open is False


def test_private_access_join_fields_round_trip(configured: Path) -> None:
    access = {**PRIVATE_JSON["access"], "join_token": "abc123", "join_open": True}  # type: ignore[dict-item]
    _write_instance_json(configured, {**PRIVATE_JSON, "access": access})

    config = instance_config.load_instance_config()

    assert config is not None
    assert isinstance(config.access, PrivateAccess)
    assert config.access.join_token == "abc123"
    assert config.access.join_open is True


# --- private-access mutation (#1019) --------------------------------------------------------


def test_set_join_open_persists(configured: Path) -> None:
    _write_instance_json(configured, PRIVATE_JSON)

    access = instance_config.set_join_open(True)

    assert access.join_open is True
    reloaded = instance_config.load_instance_config()
    assert reloaded is not None
    assert reloaded.access.join_open is True  # type: ignore[union-attr]

    access = instance_config.set_join_open(False)
    assert access.join_open is False


def test_get_or_create_join_token_generates_once(configured: Path) -> None:
    """A first read generates and persists a token; a second read returns the same value rather
    than rotating it.
    """
    _write_instance_json(configured, PRIVATE_JSON)

    first = instance_config.get_or_create_join_token()
    second = instance_config.get_or_create_join_token()

    assert first == second
    assert first  # non-empty
    reloaded = instance_config.load_instance_config()
    assert reloaded is not None
    assert reloaded.access.join_token == first  # type: ignore[union-attr]


def test_get_or_create_join_token_does_not_regenerate_an_existing_token(configured: Path) -> None:
    access = {**PRIVATE_JSON["access"], "join_token": "already-set"}  # type: ignore[dict-item]
    _write_instance_json(configured, {**PRIVATE_JSON, "access": access})

    assert instance_config.get_or_create_join_token() == "already-set"


def test_mutation_raises_when_no_slug_configured(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENERGETICA_INSTANCE_SLUG", raising=False)
    monkeypatch.setenv("ENERGETICA_INSTANCE_CONFIG_DIR", str(tmp_path))

    with pytest.raises(InstanceNotPrivateError):
        instance_config.set_join_open(True)


def test_mutation_raises_when_no_config_file(configured: Path) -> None:
    with pytest.raises(InstanceNotPrivateError):
        instance_config.set_join_open(True)


def test_mutation_raises_on_public_instance(configured: Path) -> None:
    _write_instance_json(configured, PUBLIC_JSON)

    with pytest.raises(InstanceNotPrivateError):
        instance_config.set_join_open(True)


def test_mutation_is_atomic_under_concurrent_calls(configured: Path) -> None:
    """Many threads racing to generate the join token must all observe the same, single value.

    No lost update, and no partial write ever readable on disk. (The list-mutation version of
    this test, for the now-removed add_allowed_username, went with it — #1030 follow-up.)
    """
    _write_instance_json(configured, PRIVATE_JSON)
    tokens: list[str] = []
    lock = threading.Lock()

    def generate() -> None:
        token = instance_config.get_or_create_join_token()
        with lock:
            tokens.append(token)

    threads = [threading.Thread(target=generate) for _ in range(20)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert len(tokens) == 20
    assert len(set(tokens)) == 1  # every thread observed the same, single generated token


# --- publish + aggregate --------------------------------------------------------------------


def test_publish_strips_access_block(configured: Path) -> None:
    """The fragment written to the landing dir must never carry the allowlist — only whether one
    applies survives, as ``private`` (#1030: the lobby needs this to gate the two-click join).
    """
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
        "private": True,
        "starts_at": fragment["starts_at"],
        "freeze_at": None,
        "ended_at": None,
    }


def test_publish_files_are_group_readable(configured: Path) -> None:
    """Published files must be group-readable: Apache (www-data, group energetica) serves the
    landing dir statically and is not the file owner, so the mkstemp-default 0o600 would 403.
    0o640 (not 0o644) keeps the on-disk file from being world-readable.
    """
    instance_config.publish(InstanceConfig.model_validate(PUBLIC_JSON))

    landing_dir = Path(configured).parent / "landing"
    fragment_path = landing_dir / "instances" / f"{SLUG}.json"
    manifest_path = landing_dir / "instances.json"

    assert fragment_path.stat().st_mode & 0o777 == 0o640
    assert manifest_path.stat().st_mode & 0o777 == 0o640


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


def test_aggregate_excludes_unadvertised_instances(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """An unadvertised instance keeps its on-disk fragment but must not appear in the world-readable
    instances.json — its slug is a subdomain and listing it would defeat 'unadvertised'.
    """
    landing_dir = tmp_path / "landing"
    monkeypatch.setenv("ENERGETICA_LANDING_DIR", str(landing_dir))

    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", "public-run")
    instance_config.publish(InstanceConfig.model_validate(PUBLIC_JSON))
    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", "hidden-run")
    instance_config.publish(InstanceConfig.model_validate({**PRIVATE_JSON, "advertised": False}))

    # Both fragments exist on disk...
    assert (landing_dir / "instances" / "public-run.json").exists()
    assert (landing_dir / "instances" / "hidden-run.json").exists()
    # ...but only the advertised one is in the public manifest.
    manifest = json.loads((landing_dir / "instances.json").read_text())
    assert [entry["slug"] for entry in manifest["instances"]] == ["public-run"]


def test_list_advertised_fragments_returns_only_advertised_sorted_desc(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The picker's 'other runs to join' read: advertised fragments only, most recent first."""
    landing_dir = tmp_path / "landing"
    monkeypatch.setenv("ENERGETICA_LANDING_DIR", str(landing_dir))

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
    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", "hidden-run")
    instance_config.publish(InstanceConfig.model_validate({**PRIVATE_JSON, "advertised": False}))

    fragments = instance_config.list_advertised_fragments()

    assert [fragment.slug for fragment in fragments] == ["autumn-2025", "spring-2025"]
    assert all(fragment.advertised for fragment in fragments)


def test_list_advertised_fragments_empty_when_no_landing_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENERGETICA_LANDING_DIR", str(tmp_path / "does-not-exist"))
    assert instance_config.list_advertised_fragments() == []


# --- load_fragment --------------------------------------------------------------------------


def test_load_fragment_reads_a_published_fragment(configured: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """load_fragment reads back a fragment written by publish, including its name and starts_at."""
    instance_config.publish(InstanceConfig.model_validate(PUBLIC_JSON))

    fragment = instance_config.load_fragment(SLUG)

    assert fragment is not None
    assert fragment.slug == SLUG
    assert fragment.name == "Autumn 2025"


def test_load_fragment_reads_unadvertised_fragment(configured: Path) -> None:
    """An unadvertised run keeps its on-disk fragment; load_fragment must surface it so an account
    can see its own hidden runs (the public manifest can't).
    """
    monkeypatch_slug = "hidden-run"
    (Path(instance_config._landing_dir()) / "instances").mkdir(parents=True, exist_ok=True)
    (Path(instance_config._landing_dir()) / "instances" / f"{monkeypatch_slug}.json").write_text(
        json.dumps(
            {"slug": monkeypatch_slug, "name": "Hidden", "advertised": False, "starts_at": "2026-03-01T00:00:00Z"}
        ),
        encoding="utf-8",
    )

    fragment = instance_config.load_fragment(monkeypatch_slug)

    assert fragment is not None
    assert fragment.advertised is False
    assert fragment.name == "Hidden"


def test_load_fragment_returns_none_when_absent(configured: Path) -> None:
    assert instance_config.load_fragment("no-such-run") is None


# --- timestamps + derived phase -------------------------------------------------------------

STARTS = datetime(2026, 1, 1, tzinfo=timezone.utc)
FREEZE = datetime(2026, 2, 1, tzinfo=timezone.utc)
ENDED = datetime(2026, 3, 1, tzinfo=timezone.utc)

# The full-lifecycle config the phase tests key off (all three boundaries set).
LIFECYCLE_JSON = {
    "name": "Lifecycle",
    "advertised": True,
    "starts_at": "2026-01-01T00:00:00Z",
    "freeze_at": "2026-02-01T00:00:00Z",
    "ended_at": "2026-03-01T00:00:00Z",
    "access": {"policy": "public"},
}


@pytest.mark.parametrize(
    ("now", "expected"),
    [
        (datetime(2025, 12, 31, tzinfo=timezone.utc), "announced"),  # before starts_at
        (STARTS, "active"),  # exactly at a boundary is already the later phase
        (datetime(2026, 1, 15, tzinfo=timezone.utc), "active"),
        (FREEZE, "freeze"),
        (datetime(2026, 2, 15, tzinfo=timezone.utc), "freeze"),
        (ENDED, "ended"),
        (datetime(2026, 4, 1, tzinfo=timezone.utc), "ended"),
    ],
)
def test_derive_phase_walks_the_ladder(now: datetime, expected: str) -> None:
    assert derive_phase(now, starts_at=STARTS, freeze_at=FREEZE, ended_at=ENDED) == expected


def test_derive_phase_naive_now_recovered_as_utc() -> None:
    """A naive ``now`` (the ``datetime.now()`` footgun) is recovered as UTC rather than raising
    TypeError against the aware boundaries — a phase read must always yield a phase.
    """
    naive_mid_active = datetime(2026, 1, 15)  # no tzinfo
    assert derive_phase(naive_mid_active, starts_at=STARTS, freeze_at=FREEZE, ended_at=ENDED) == "active"


def test_derive_phase_open_ended_run_stays_active() -> None:
    """No freeze_at / ended_at → the run never leaves active once it has started."""
    far_future = datetime(2099, 1, 1, tzinfo=timezone.utc)
    assert derive_phase(far_future, starts_at=STARTS, freeze_at=None, ended_at=None) == "active"
    assert derive_phase(STARTS, starts_at=STARTS, freeze_at=None, ended_at=None) == "active"
    before = datetime(2025, 1, 1, tzinfo=timezone.utc)
    assert derive_phase(before, starts_at=STARTS, freeze_at=None, ended_at=None) == "announced"


def test_derive_phase_ended_without_freeze() -> None:
    """ended_at fires even when freeze_at is null (active → ended directly)."""
    assert derive_phase(ENDED, starts_at=STARTS, freeze_at=None, ended_at=ENDED) == "ended"
    assert derive_phase(FREEZE, starts_at=STARTS, freeze_at=None, ended_at=ENDED) == "active"


def test_fragment_carries_and_derives_phase(configured: Path) -> None:
    """from_config threads freeze_at/ended_at through, and the fragment derives its own phase."""
    config = InstanceConfig.model_validate(LIFECYCLE_JSON)
    fragment = InstanceFragment.from_config(slug=SLUG, config=config)

    assert fragment.freeze_at == FREEZE
    assert fragment.ended_at == ENDED
    assert fragment.phase(datetime(2026, 1, 15, tzinfo=timezone.utc)) == "active"
    assert fragment.phase(datetime(2026, 2, 15, tzinfo=timezone.utc)) == "freeze"


def test_config_omitting_later_boundaries_defaults_to_none() -> None:
    """A config with only starts_at (the pre-existing shape) is still valid; the new fields default
    to None so existing instance.json files keep parsing.
    """
    config = InstanceConfig.model_validate(PUBLIC_JSON)
    assert config.freeze_at is None
    assert config.ended_at is None


def test_naive_freeze_at_fails_closed(configured: Path) -> None:
    """The tz-aware-or-fail-closed rule extends to the new timestamps."""
    _write_instance_json(configured, {**LIFECYCLE_JSON, "freeze_at": "2026-02-01T00:00:00"})
    with pytest.raises(InstanceConfigError):
        instance_config.load_instance_config()


@pytest.mark.parametrize(
    "broken",
    [
        {"freeze_at": "2025-12-01T00:00:00Z"},  # freeze before starts
        {"ended_at": "2026-01-15T00:00:00Z"},  # ended before freeze
        {"freeze_at": None, "ended_at": "2025-12-15T00:00:00Z"},  # ended before starts, no freeze
    ],
)
def test_out_of_order_timestamps_rejected(broken: dict) -> None:
    """starts_at ≤ freeze_at ≤ ended_at is enforced — the invariant that makes the two-timestamp
    model unambiguous (why it supersedes #809).
    """
    with pytest.raises(ValueError):
        InstanceConfig.model_validate({**LIFECYCLE_JSON, **broken})


def test_equal_timestamps_allowed() -> None:
    """Non-decreasing, not strictly increasing: a zero-width phase is odd but not a mistake."""
    config = InstanceConfig.model_validate(
        {**LIFECYCLE_JSON, "freeze_at": "2026-02-01T00:00:00Z", "ended_at": "2026-02-01T00:00:00Z"}
    )
    assert config.freeze_at == config.ended_at


def test_current_phase_reads_own_config(configured: Path) -> None:
    """current_phase derives this instance's live phase from its on-disk config (#861) — the source
    both the sim halt and the write-gate key off.
    """
    _write_instance_json(configured, LIFECYCLE_JSON)
    assert instance_config.current_phase(datetime(2026, 1, 15, tzinfo=timezone.utc)) == "active"
    assert instance_config.current_phase(datetime(2026, 2, 15, tzinfo=timezone.utc)) == "freeze"
    assert instance_config.current_phase(datetime(2026, 4, 1, tzinfo=timezone.utc)) == "ended"


def test_current_phase_unconfigured_is_active(configured: Path) -> None:
    """No instance.json (dev/legacy, open-ended run) → active: an unconfigured instance never freezes."""
    assert instance_config.current_phase(datetime(2026, 4, 1, tzinfo=timezone.utc)) == "active"


def test_current_phase_broken_config_fails_open_to_active(configured: Path) -> None:
    """A present-but-broken config fails **open** to active.

    A config typo must not silently freeze a live game. (The login path fails *closed* on the same
    file; freeze is entered only on a positive clock signal, never on an error.)
    """
    _write_instance_json(configured, "{ not valid json")
    assert instance_config.current_phase(datetime(2026, 4, 1, tzinfo=timezone.utc)) == "active"


# --- retire_fragment (teardown, T7) -----------------------------------------------------------


def _write_recap(landing_dir: Path, slug: str, payload: dict | str) -> None:
    recap_path = landing_dir / "recaps" / f"{slug}.json"
    recap_path.parent.mkdir(parents=True, exist_ok=True)
    recap_path.write_text(payload if isinstance(payload, str) else json.dumps(payload), encoding="utf-8")


# The smallest payload that actually validates as a Recap — an empty run, minted and readable.
# It has to be a real one: retire_fragment asks whether a *loadable* recap survived, not whether
# a file is there, so a stub would be indistinguishable from the corruption case below.
VALID_RECAP = {
    "slug": SLUG,
    "name": "Autumn 2025",
    "starts_at": "2025-09-15T00:00:00Z",
    "freeze_at": "2025-12-01T00:00:00Z",
    "ended_at": None,
    "player_count": 0,
    "total_produced_co2": 0.0,
    "total_captured_co2": 0.0,
    "total_net_emissions": 0.0,
    "rows": [],
    "tiles": [],
}


def test_retire_fragment_deletes_when_no_recap(configured: Path) -> None:
    """A run torn down before it ever froze leaves nothing to point at, so its fragment goes."""
    instance_config.publish(InstanceConfig.model_validate(PUBLIC_JSON))
    landing_dir = Path(configured).parent / "landing"

    assert instance_config.retire_fragment(SLUG) is True

    assert not (landing_dir / "instances" / f"{SLUG}.json").exists()
    assert json.loads((landing_dir / "instances.json").read_text())["instances"] == []


def test_retire_fragment_keeps_the_fragment_when_a_recap_exists(configured: Path) -> None:
    """The headstone rule: the fragment is the *only* pointer the lobby finds a recap by, so a run
    that minted one keeps its fragment through teardown — otherwise the recap survives on disk and
    nothing links to it, defeating the reason it was minted.
    """
    instance_config.publish(InstanceConfig.model_validate(PUBLIC_JSON))
    landing_dir = Path(configured).parent / "landing"
    _write_recap(landing_dir, SLUG, VALID_RECAP)

    assert instance_config.retire_fragment(SLUG) is False

    assert (landing_dir / "instances" / f"{SLUG}.json").exists()
    assert instance_config.load_fragment(SLUG) is not None
    assert [entry["slug"] for entry in json.loads((landing_dir / "instances.json").read_text())["instances"]] == [SLUG]


@pytest.mark.parametrize("payload", ["{ not valid json", '{"slug": "autumn-2025"}'], ids=["truncated", "wrong-schema"])
def test_retire_fragment_treats_an_unloadable_recap_as_no_recap(configured: Path, payload: str) -> None:
    """A recap the lobby cannot render must not hold the fragment open.

    The guard is ``load_recap``, not bare file-existence: keeping the fragment for a truncated or
    schema-invalid artifact would leave the card advertising "View recap" over a file that never
    loads — and teardown is precisely when the ability to re-mint it is being destroyed, so the
    question has to be whether a *usable* recap survived. (``teardown-instance.sh`` refuses to run
    at all in this state, since the run is still recoverable then; this is the fail-safe beneath it.)
    """
    instance_config.publish(InstanceConfig.model_validate(PUBLIC_JSON))
    landing_dir = Path(configured).parent / "landing"
    _write_recap(landing_dir, SLUG, payload)

    assert instance_config.retire_fragment(SLUG) is True
    assert not (landing_dir / "instances" / f"{SLUG}.json").exists()


def test_retire_fragment_leaves_sibling_runs_listed(configured: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Re-aggregation after a retire must drop only the retired run from the manifest."""
    instance_config.publish(InstanceConfig.model_validate(PUBLIC_JSON))
    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", "spring-2026")
    instance_config.publish(InstanceConfig.model_validate({**PUBLIC_JSON, "name": "Spring 2026"}))

    instance_config.retire_fragment(SLUG)

    landing_dir = Path(configured).parent / "landing"
    manifest = json.loads((landing_dir / "instances.json").read_text())
    assert [entry["slug"] for entry in manifest["instances"]] == ["spring-2026"]


def test_retire_fragment_is_idempotent(configured: Path) -> None:
    """Teardown is re-runnable: retiring an already-retired run is a no-op, not an error."""
    instance_config.publish(InstanceConfig.model_validate(PUBLIC_JSON))

    assert instance_config.retire_fragment(SLUG) is True
    assert instance_config.retire_fragment(SLUG) is True
