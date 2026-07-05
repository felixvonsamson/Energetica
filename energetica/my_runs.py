"""The shared ``my-runs`` read: an account's settled runs, joined against on-disk fragments.

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
from energetica.schemas.lobby import MyRun, MyRunsResponse

logger = logging.getLogger(__name__)


def _parse_settled_at(raw: str) -> datetime | None:
    """Parse a stored ``settled_at`` into an aware datetime, or ``None`` if it is unusable.

    ``record_membership`` normalises every write to aware UTC, so a bad value only arises from a
    legacy/restored/hand-edited row. Rather than let one such row 500 the whole endpoint (and hide
    *every* run for the account), recover a naive timestamp as UTC — matching the write-side
    normalisation — and drop a truly unparseable one, consistent with how stale rows are skipped.
    """
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)


def resolve_my_runs(account_id: int) -> MyRunsResponse:
    """The account's settled runs, joined with each run's on-disk fragment for name / starts_at,
    most recently settled first. Stale memberships (run since deleted → no fragment) are dropped,
    and an account's own *unadvertised* runs are surfaced (their fragment exists on disk).
    """
    runs: list[MyRun] = []
    for membership in accounts.get_memberships(account_id=account_id):
        fragment = instance_config.load_fragment(membership.slug)
        if fragment is None:
            continue
        settled_at = _parse_settled_at(membership.settled_at)
        if settled_at is None:
            logger.warning(
                "skipping membership with unparseable settled_at %r (account_id=%s, slug=%s)",
                membership.settled_at,
                account_id,
                membership.slug,
            )
            continue
        runs.append(MyRun(slug=fragment.slug, name=fragment.name, starts_at=fragment.starts_at, settled_at=settled_at))
    return MyRunsResponse(runs=runs)
