"""The shared ``my-runs`` read: an account's joined runs, joined against on-disk fragments.

Both origins serve this identical logic from their own backend — the instance (``GET
/lobby/my-runs``, for the in-run switcher) and the lobby service (for the picker) — so neither
frontend makes a cross-origin call. Factored here so it is literally one function, not two copies.

Depends only on the accounts store and the fragment reader; it does not touch the game engine, so
the lobby imports it freely (ADR-0002, lobby Phase B).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from energetica import accounts, instance_config
from energetica.schemas.lobby import FacilitatedRun, MyRun, MyRunsResponse

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


def resolve_my_runs(account_id: int, username: str) -> MyRunsResponse:
    """The account's joined runs — settled or not (#1030) — joined with each run's on-disk
    fragment for name / starts_at, most recently joined first. Stale memberships (run since
    deleted → no fragment) are dropped, and an account's own *unadvertised* runs are surfaced
    (their fragment exists on disk).

    ``username`` is echoed back so the change-password form can carry an ``autocomplete="username"``
    field — password managers only offer to *update* the right stored credential when the change
    form identifies which account it belongs to. Both callers already hold it, so it is passed in
    rather than re-read from the store.

    Also joins the account's instance-scoped facilitator grants against the same fragments, into
    ``facilitated_runs`` (#1032) — a server-wide grant is excluded (see
    :func:`accounts.get_facilitator_grants`). Both origins that call this function get the new
    field; only the lobby picker's UI reads it today.
    """
    runs: list[MyRun] = []
    for membership in accounts.get_memberships(account_id=account_id):
        # get_memberships only returns role="player" rows, and a player's slug is never NULL
        # (only a server-wide facilitator grant can have one) — see ADR-0004.
        assert membership.slug is not None
        fragment = instance_config.load_fragment(membership.slug)
        if fragment is None:
            continue
        joined_at = _parse_aware(membership.created_at)
        if joined_at is None:
            logger.warning(
                "skipping membership with unparseable created_at %r (account_id=%s, slug=%s)",
                membership.created_at,
                account_id,
                membership.slug,
            )
            continue
        # A present-but-unparseable settled_at reads as still-joined-only rather than dropping the
        # whole run — a bad value here shouldn't hide an otherwise-valid membership the way a bad
        # joined_at does.
        settled_at = _parse_aware(membership.settled_at)
        runs.append(
            MyRun(
                slug=fragment.slug,
                name=fragment.name,
                starts_at=fragment.starts_at,
                freeze_at=fragment.freeze_at,
                ended_at=fragment.ended_at,
                joined_at=joined_at,
                settled_at=settled_at,
            )
        )

    facilitated_runs: list[FacilitatedRun] = []
    for grant in accounts.get_facilitator_grants(account_id=account_id):
        # get_facilitator_grants excludes slug IS NULL (server-wide) rows by construction.
        assert grant.slug is not None
        fragment = instance_config.load_fragment(grant.slug)
        if fragment is None:
            continue
        granted_at = _parse_aware(grant.created_at)
        if granted_at is None:
            logger.warning(
                "skipping facilitator grant with unparseable created_at %r (account_id=%s, slug=%s)",
                grant.created_at,
                account_id,
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

    return MyRunsResponse(username=username, runs=runs, facilitated_runs=facilitated_runs)
