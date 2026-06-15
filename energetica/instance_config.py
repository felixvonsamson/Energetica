"""Per-instance visibility and access policy.

Each instance declares its visibility (``advertised``) and access policy
(``public`` / ``private`` allowlist) in a single admin-owned file that lives
**outside** the vhost DocumentRoot:

    {ENERGETICA_INSTANCE_CONFIG_DIR}/{slug}/instance.json   (default dir: /etc/energetica)

The file is re-read on every login attempt — there is no in-memory cache of the
policy, so admin edits take effect on the next login with no restart.

On startup and whenever the public-facing fields change, the instance publishes a
*sanitised* fragment (the ``access`` block stripped) to the landing directory and
re-aggregates the manifest Apache serves to the public:

    {ENERGETICA_LANDING_DIR}/instances/{slug}.json   (per-instance fragment)
    {ENERGETICA_LANDING_DIR}/instances.json          (aggregate, sorted by starts_at desc)

See ``docs/architecture/static-serving-and-deployment.md`` § Instance Visibility & Access.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field

logger = logging.getLogger(__name__)

_SLUG_ENV_VAR = "ENERGETICA_INSTANCE_SLUG"
_CONFIG_DIR_ENV_VAR = "ENERGETICA_INSTANCE_CONFIG_DIR"
_LANDING_DIR_ENV_VAR = "ENERGETICA_LANDING_DIR"

_DEFAULT_CONFIG_DIR = "/etc/energetica"
_DEFAULT_LANDING_DIR = "/var/www/energetica-landing"


class InstanceConfigError(Exception):
    """Raised when an instance.json file exists but cannot be read or validated.

    A present-but-broken policy file on a security boundary must fail closed (deny),
    never fall back to public — that would silently grant access on a typo.
    """


class PublicAccess(BaseModel):
    # ``forbid`` so a half-edited private config (e.g. policy mistyped back to "public" while
    # allowed_usernames lingers) fails closed instead of silently dropping the allowlist and
    # parsing as world-open.
    model_config = {"extra": "forbid"}

    policy: Literal["public"]


class PrivateAccess(BaseModel):
    model_config = {"extra": "forbid"}

    policy: Literal["private"]
    allowed_usernames: list[str] = Field(default_factory=list)


AccessPolicy = PublicAccess | PrivateAccess


class InstanceConfig(BaseModel):
    """The full per-instance config, including the private ``access`` block.

    Never serialised to the landing dir — only its sanitised :class:`InstanceFragment`
    projection is. ``model_config`` forbids extra keys so a malformed file fails closed.
    """

    model_config = {"extra": "forbid"}

    name: str
    advertised: bool
    # Timezone-aware required: naive timestamps are rejected (fail closed), which also guarantees
    # every published fragment is aware so the aggregation sort never mixes naive/aware datetimes.
    starts_at: AwareDatetime
    access: AccessPolicy = Field(discriminator="policy")


class InstanceFragment(BaseModel):
    """The public projection written to the landing dir. The ``access`` block is stripped."""

    slug: str
    name: str
    advertised: bool
    starts_at: AwareDatetime

    @classmethod
    def from_config(cls, *, slug: str, config: InstanceConfig) -> InstanceFragment:
        return cls(slug=slug, name=config.name, advertised=config.advertised, starts_at=config.starts_at)


def instance_slug() -> str | None:
    """The instance's own slug, from the environment. ``None`` in dev / unconfigured deployments."""
    slug = os.environ.get(_SLUG_ENV_VAR)
    return slug or None


def _config_dir() -> Path:
    return Path(os.environ.get(_CONFIG_DIR_ENV_VAR, _DEFAULT_CONFIG_DIR))


def _landing_dir() -> Path:
    return Path(os.environ.get(_LANDING_DIR_ENV_VAR, _DEFAULT_LANDING_DIR))


def _instance_json_path() -> Path | None:
    slug = instance_slug()
    if slug is None:
        return None
    return _config_dir() / slug / "instance.json"


def load_instance_config() -> InstanceConfig | None:
    """Read and validate this instance's ``instance.json``.

    Returns ``None`` when the slug is unset or the file is absent — both mean "unconfigured",
    which callers treat as the documented default of ``public`` (preserves dev/legacy behaviour).

    Raises :class:`InstanceConfigError` when the file is present but unreadable or invalid, so a
    broken policy fails closed instead of silently granting access.
    """
    path = _instance_json_path()
    if path is None or not path.exists():
        return None
    try:
        return InstanceConfig.model_validate_json(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        # ValueError covers pydantic ValidationError and JSON decode errors.
        raise InstanceConfigError(f"invalid instance.json at {path}: {exc}") from exc


def is_access_allowed(config: InstanceConfig, username: str) -> bool:
    """Whether ``username`` may log in / sign up on this instance under ``config``'s policy."""
    if isinstance(config.access, PublicAccess):
        return True
    return username in config.access.allowed_usernames


def _atomic_write_json(target: Path, payload: str) -> None:
    """Write ``payload`` to ``target`` atomically: write a unique tmp sibling, then ``os.replace``.

    The rename is atomic on POSIX, so a concurrent reader (Apache, another instance's
    aggregation) never observes a partial file. The tmp name is unique per call (``mkstemp``) so
    two instance processes aggregating into the same ``instances.json`` concurrently cannot
    clobber a shared tmp file mid-write. The ``.tmp`` suffix keeps tmp files out of the
    ``*.json`` glob the aggregator reads.
    """
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=target.parent, prefix=f"{target.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as tmp_file:
            tmp_file.write(payload)
        os.replace(tmp_name, target)
    except BaseException:
        Path(tmp_name).unlink(missing_ok=True)
        raise


def aggregate_instances() -> None:
    """Aggregate every ``instances/*.json`` fragment into ``instances.json``, sorted by
    ``starts_at`` descending so the most recent instance is first.

    Pure-Python equivalent of the RFC's ``jq`` one-liner — same output shape, no subprocess
    or runtime ``jq`` dependency. Last-writer-wins across concurrent aggregations is harmless:
    every aggregator reads the same fragment dir and produces a complete snapshot.
    """
    fragments_dir = _landing_dir() / "instances"
    fragments: list[InstanceFragment] = []
    for fragment_path in fragments_dir.glob("*.json"):
        try:
            fragments.append(InstanceFragment.model_validate_json(fragment_path.read_text(encoding="utf-8")))
        except (OSError, ValueError):
            # A malformed sibling fragment must not poison the whole manifest. Skip and warn.
            logger.warning("skipping unreadable instance fragment %s", fragment_path)
    fragments.sort(key=lambda fragment: fragment.starts_at, reverse=True)
    manifest = {"instances": [json.loads(fragment.model_dump_json()) for fragment in fragments]}
    _atomic_write_json(_landing_dir() / "instances.json", json.dumps(manifest))


def publish(config: InstanceConfig | None) -> None:
    """Write this instance's sanitised fragment and re-aggregate the manifest.

    Best-effort: a failure to publish (e.g. the landing dir is not writable in dev) is logged
    and swallowed — publishing must never break the login/access path that calls it. No-ops when
    the slug is unset (can't name a fragment file) or ``config`` is ``None`` (unconfigured).

    Called on startup and on every allowed login. The writes are cheap (a few small JSON files)
    and atomic, so there is no in-memory de-dup: re-publishing on each login is what lets an admin
    edit to ``advertised`` / ``name`` / ``starts_at`` reach the landing without a restart.
    """
    slug = instance_slug()
    if slug is None or config is None:
        return
    try:
        fragment_json = InstanceFragment.from_config(slug=slug, config=config).model_dump_json()
        _atomic_write_json(_landing_dir() / "instances" / f"{slug}.json", fragment_json)
        aggregate_instances()
    except (OSError, ValueError) as exc:
        logger.warning("could not publish instance fragment for %s: %s", slug, exc)


def publish_on_startup() -> None:
    """Publish the fragment once at process start, tolerating an unreadable/invalid config."""
    try:
        config = load_instance_config()
    except InstanceConfigError as exc:
        logger.warning("not publishing fragment on startup: %s", exc)
        return
    publish(config)
