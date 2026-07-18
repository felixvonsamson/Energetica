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
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field, model_validator

logger = logging.getLogger(__name__)

# The instance lifecycle, derived (never stored) from ``now`` vs the three transition timestamps.
# See :func:`derive_phase` for the boundaries.
Phase = Literal["announced", "active", "freeze", "ended"]


def derive_phase(
    now: datetime,
    *,
    starts_at: datetime,
    freeze_at: datetime | None,
    ended_at: datetime | None,
) -> Phase:
    """The lifecycle phase at ``now``, a pure function of the three transition timestamps.

    The single source of truth for "what phase is this instance in" — both the backend and the
    lobby/app frontends (``derivePhase`` in ``frontend/src/lib/instances.ts``) implement this same
    ladder, so a run self-drives its transitions from its own clock with nothing to store or
    republish as time passes.

        announced ──(starts_at)──▶ active ──(freeze_at)──▶ freeze ──(ended_at)──▶ ended

    The latest boundary already crossed wins, so the checks run newest-first; a ``None`` boundary
    is simply never crossed, which is exactly how an open-ended run (no ``freeze_at`` / ``ended_at``)
    stays ``active`` forever. ``InstanceConfig`` guarantees the timestamps are non-decreasing, so
    these checks can't disagree about which phase is "current".

    The boundaries are always tz-aware (``AwareDatetime``), so a naive ``now`` — the ``datetime.now()``
    footgun — would raise ``TypeError`` on the first comparison and turn a phase read into a request
    failure. Recover it as UTC (matching ``_parse_settled_at``'s write-side convention) rather than
    crash: a phase read must always yield a phase. Callers should still pass aware UTC.
    """
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    if ended_at is not None and now >= ended_at:
        return "ended"
    if freeze_at is not None and now >= freeze_at:
        return "freeze"
    if now >= starts_at:
        return "active"
    return "announced"


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
    # The two later lifecycle boundaries (absolute, same tz-aware-or-fail-closed rule as
    # ``starts_at``). Nullable because an open-ended run leaves them unset, and a freshly-announced
    # run may not have scheduled them yet — a ``None`` boundary is simply one the phase ladder never
    # crosses (see :func:`derive_phase`). Supersedes #809's single ambiguous ``ends_at``.
    freeze_at: AwareDatetime | None = None  # active → freeze (play/sim ends, backend stays read-only)
    ended_at: AwareDatetime | None = None  # freeze → ended (process reaped, recap outlives it on the lobby)
    access: AccessPolicy = Field(discriminator="policy")

    @model_validator(mode="after")
    def _timestamps_non_decreasing(self) -> InstanceConfig:
        """The transition timestamps must run forward: ``starts_at ≤ freeze_at ≤ ended_at`` for
        whichever are present. This is what makes the two-timestamp model *unambiguous* (the reason
        it supersedes #809): a config that would freeze before it starts, or end before it freezes,
        is a mistake the phase ladder can't sensibly resolve, so it fails closed here rather than
        silently picking a phase.
        """
        ordered = [("starts_at", self.starts_at), ("freeze_at", self.freeze_at), ("ended_at", self.ended_at)]
        present = [(name, value) for name, value in ordered if value is not None]
        for (earlier_name, earlier), (later_name, later) in zip(present, present[1:]):
            if later < earlier:
                raise ValueError(f"{later_name} ({later.isoformat()}) is before {earlier_name} ({earlier.isoformat()})")
        return self


class InstanceFragment(BaseModel):
    """The public projection written to the landing dir. The ``access`` block is stripped.

    Carries the three transition timestamps (never a stored ``phase``): a fragment is published
    once and served statically for the life of the run, so the phase is derived on read from the
    timestamps it carries — see :meth:`phase` / :func:`derive_phase`.
    """

    slug: str
    name: str
    advertised: bool
    starts_at: AwareDatetime
    freeze_at: AwareDatetime | None = None
    ended_at: AwareDatetime | None = None

    @classmethod
    def from_config(cls, *, slug: str, config: InstanceConfig) -> InstanceFragment:
        return cls(
            slug=slug,
            name=config.name,
            advertised=config.advertised,
            starts_at=config.starts_at,
            freeze_at=config.freeze_at,
            ended_at=config.ended_at,
        )

    def phase(self, now: datetime) -> Phase:
        """This instance's lifecycle phase at ``now`` (see :func:`derive_phase`)."""
        return derive_phase(now, starts_at=self.starts_at, freeze_at=self.freeze_at, ended_at=self.ended_at)


def current_phase(now: datetime | None = None) -> Phase:
    """This instance's own lifecycle phase right now, from its on-disk ``instance.json``.

    The running backend self-drives its ``active → freeze → ended`` transitions from this — the sim
    halt (``state_update``) and the read-only write-gate (``reject_when_frozen``) both key off it. The
    config is re-read every call (no cache), exactly like the login/access path, so an admin editing
    ``freeze_at`` (the manual force-freeze / adjustment override) takes effect on the next check with
    no restart.

    Fails **open** — returns ``active`` — when the instance is unconfigured (dev/legacy: no slug or no
    file → open-ended run, no freeze boundary) or the config is present-but-broken. A config typo must
    not silently freeze a live game; the login path already fails *closed* on a broken config, so
    entry stops there, while the running game keeps serving until a *readable* ``freeze_at`` is
    actually crossed. Freeze is entered only on a positive clock signal, never on an error.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    try:
        config = load_instance_config()
    except InstanceConfigError as exc:
        logger.warning("treating instance as active; could not read config for phase: %s", exc)
        return "active"
    if config is None:
        return "active"
    return derive_phase(now, starts_at=config.starts_at, freeze_at=config.freeze_at, ended_at=config.ended_at)


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


def load_fragment(slug: str) -> InstanceFragment | None:
    """Read a single on-disk instance fragment by slug, or ``None`` if it is absent or unreadable.

    Fragments are the public projection published to the landing dir (``name`` / ``advertised`` /
    ``starts_at``), and exist for **unadvertised** runs too — so this is how an account discovers
    its own hidden runs when joining ``instance_membership`` against on-disk metadata. A stale
    membership (run since deleted → fragment gone) or a malformed fragment reads as ``None``, and
    the caller filters it out.
    """
    fragment_path = _landing_dir() / "instances" / f"{slug}.json"
    if not fragment_path.exists():
        return None
    try:
        return InstanceFragment.model_validate_json(fragment_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        logger.warning("skipping unreadable instance fragment %s", fragment_path)
        return None


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

    The published file is made group-readable (``0o640``): ``mkstemp`` forces ``0o600`` and
    ``os.replace`` preserves that mode, but Apache (running as ``www-data``, a member of the
    shared ``energetica`` group) must read these files to serve the landing manifest. ``0o640``
    rather than ``0o644`` keeps the on-disk file from being world-readable — the HTTP exposure is
    intentional, the filesystem one need not be. The ``chmod`` is inside the ``try`` so a failure
    routes through the cleanup path below and no ``0o600`` tmp file is renamed into place.
    """
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=target.parent, prefix=f"{target.name}.", suffix=".tmp")
    fd_open = True  # mkstemp's raw fd is ours until os.fdopen takes ownership of it
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as tmp_file:
            fd_open = False  # fdopen owns the fd now; the context manager will close it
            tmp_file.write(payload)
        os.chmod(tmp_name, 0o640)
        os.replace(tmp_name, target)
    except BaseException:
        # Close the fd only if fdopen never took ownership (else the `with` already closed it;
        # blindly re-closing would risk a thread-unsafe double-close on a recycled fd).
        if fd_open:
            os.close(fd)
        Path(tmp_name).unlink(missing_ok=True)
        raise


def list_advertised_fragments() -> list[InstanceFragment]:
    """Read all on-disk fragments, keep only the **advertised** ones, sorted by ``starts_at``
    descending (most recent first).

    Only advertised instances are included: a slug *is* a subdomain, so surfacing an unadvertised
    instance would let anyone enumerate and target an otherwise-hidden run. Unadvertised instances
    keep their on-disk fragment (reachable only by already knowing the slug) but never appear here.

    Shared by both consumers of "the runs on offer": the world-readable ``instances.json``
    (:func:`aggregate_instances`) and the lobby picker's "other runs to join". A malformed sibling
    fragment is skipped (and warned) rather than poisoning the whole list. A missing landing dir
    yields an empty list.
    """
    fragments_dir = _landing_dir() / "instances"
    fragments: list[InstanceFragment] = []
    for fragment_path in fragments_dir.glob("*.json"):
        try:
            fragment = InstanceFragment.model_validate_json(fragment_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            logger.warning("skipping unreadable instance fragment %s", fragment_path)
            continue
        if fragment.advertised:
            fragments.append(fragment)
    fragments.sort(key=lambda fragment: fragment.starts_at, reverse=True)
    return fragments


def aggregate_instances() -> None:
    """Aggregate the **advertised** ``instances/*.json`` fragments into ``instances.json``, sorted
    by ``starts_at`` descending so the most recent instance is first.

    Pure-Python equivalent of the RFC's ``jq`` one-liner — same output shape, no subprocess
    or runtime ``jq`` dependency. Last-writer-wins across concurrent aggregations is harmless:
    every aggregator reads the same fragment dir and produces a complete snapshot.
    """
    fragments = list_advertised_fragments()
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
