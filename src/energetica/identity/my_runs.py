"""The shared ``my-runs`` read: an account's joined runs, joined against on-disk fragments.

Both origins serve this identical logic from their own backend — the instance (``GET
/lobby/my-runs``, for the in-run switcher) and the lobby backend (for the picker) — so neither
frontend makes a cross-origin call. :func:`build_my_runs` is the shared part: it takes the
memberships, which both get from the lobby service's API (ADR-0009), and joins them with the
fragments.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from energetica.identity import instance_config
from energetica.identity.schemas.lobby import FacilitatedRun, MyRun, MyRunsResponse
from energetica.identity.schemas.lobby_service import MembershipsOut

logger = logging.getLogger(__name__)


def _parse_aware(raw: str | None) -> datetime | None:
    """Parse a stored timestamp into an aware datetime; ``None`` in, or unparseable, both yield
    ``None`` out.

    Writes to ``instance_membership`` normalise every timestamp to aware UTC, so a bad value only
    arises from a legacy/restored/hand-edited row. Rather than let one such row 500 the whole
    endpoint (and hide *every* run for the account), recover a naive timestamp as UTC — matching
    the write-side normalisation — and drop a truly unparseable one, consistent with how stale
    rows are skipped.
    """
    if raw is None:
        return None
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)


def build_my_runs(username: str, memberships: MembershipsOut, *, expires_at: str | None = None) -> MyRunsResponse:
    """The account's joined runs — settled or not (#1030) — joined with each run's on-disk
    fragment for name / starts_at, most recently joined first. Stale memberships (run since
    deleted → no fragment) are dropped, and an account's own *unadvertised* runs are surfaced
    (their fragment exists on disk).

    ``username`` is echoed back so the change-password form can carry an ``autocomplete="username"``
    field — password managers only offer to *update* the right stored credential when the change
    form identifies which account it belongs to. Both callers already hold it, so it is passed in
    rather than re-read from the store.

    Also joins the account's instance-scoped facilitator grants against the same fragments, into
    ``facilitated_runs`` (#1032) — a server-wide grant is not tied to a run, so ``memberships``
    never holds one. Both origins that call this function get the field; only the lobby picker's
    UI reads it today.

    ``expires_at`` is the account's own, echoed back so the picker can hide freeplay Runs from a
    temporary account, which cannot join one (#1383).
    """
    runs: list[MyRun] = []
    for membership in memberships.runs:
        fragment = instance_config.load_fragment(membership.slug)
        if fragment is None:
            continue
        joined_at = _parse_aware(membership.joined_at)
        if joined_at is None:
            logger.warning(
                "skipping membership with unparseable joined_at %r (username=%s, slug=%s)",
                membership.joined_at,
                username,
                membership.slug,
            )
            continue
        runs.append(
            MyRun(
                slug=fragment.slug,
                name=fragment.name,
                mode=fragment.mode,
                starts_at=fragment.starts_at,
                freeze_at=fragment.freeze_at,
                ended_at=fragment.ended_at,
                joined_at=joined_at,
            )
        )

    facilitated_runs: list[FacilitatedRun] = []
    for grant in memberships.facilitated_runs:
        fragment = instance_config.load_fragment(grant.slug)
        if fragment is None:
            continue
        granted_at = _parse_aware(grant.granted_at)
        if granted_at is None:
            logger.warning(
                "skipping facilitator grant with unparseable granted_at %r (username=%s, slug=%s)",
                grant.granted_at,
                username,
                grant.slug,
            )
            continue
        facilitated_runs.append(
            FacilitatedRun(
                slug=fragment.slug,
                name=fragment.name,
                starts_at=fragment.starts_at,
                freeze_at=fragment.freeze_at,
                ended_at=fragment.ended_at,
                granted_at=granted_at,
            )
        )

    return MyRunsResponse(
        username=username,
        runs=runs,
        facilitated_runs=facilitated_runs,
        expires_at=_parse_aware(expires_at),
    )
