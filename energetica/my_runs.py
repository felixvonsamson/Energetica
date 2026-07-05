"""The shared ``my-runs`` read: an account's settled runs, joined against on-disk fragments.

Both origins serve this identical logic from their own backend — the instance (``GET
/lobby/my-runs``, for the in-run switcher) and the lobby service (for the picker) — so neither
frontend makes a cross-origin call. Factored here so it is literally one function, not two copies.

Depends only on the accounts store and the fragment reader; it does not touch the game engine, so
the lobby imports it freely (ADR-0002, lobby Phase B).
"""

from __future__ import annotations

from datetime import datetime

from energetica import accounts, instance_config
from energetica.schemas.lobby import MyRun, MyRunsResponse


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
        runs.append(
            MyRun(
                slug=fragment.slug,
                name=fragment.name,
                starts_at=fragment.starts_at,
                # Stored as an ISO-8601 string (aware, written from Player.created_at); parse back
                # to the aware datetime the schema declares rather than lean on Pydantic coercion.
                settled_at=datetime.fromisoformat(membership.settled_at),
            )
        )
    return MyRunsResponse(runs=runs)
