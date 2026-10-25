"""Facilitator instance-admin surface: join link/toggle (#1020) and the roster page (#1022).

Exposes two write paths over HTTP: #1019's run-level config (``instance_config``'s
``get_or_create_join_token`` / ``set_join_open``, for the join link and its open/closed toggle),
and the roster itself, which is the run's membership in the lobby service (ADR-0007, ADR-0009)
rather than ``instance.json``. Every route here is instance-wide, not tied to *which*
facilitator is calling, so the auth gate is a router-level dependency rather than a per-route
parameter each handler would otherwise ignore.

Both the persistent world and Workshop serve these routes (#1138).
"""

from typing import Annotated, Callable, TypeVar

from fastapi import APIRouter, Depends, Query

from energetica.identity import instance_config
from energetica.identity.game_error import IdentityErrorCode
from energetica.identity.lobby_service_client import LobbyServiceRefusal
from energetica.identity.schemas.facilitator import (
    FacilitatorAccessOut,
    FacilitatorAccessPatch,
    FacilitatorRosterOut,
    RosterAddIn,
    RosterCandidatesOut,
)
from energetica.identity.schemas.lobby_service import LobbyServiceErrorCode
from energetica.identity.web import get_facilitator, lobby_service
from energetica.kernel.game_error import GameError, SharedErrorCode

router = APIRouter(prefix="/facilitator", tags=["Facilitator"], dependencies=[Depends(get_facilitator)])

_T = TypeVar("_T")


def _or_not_private(mutate: Callable[[], _T]) -> _T:
    """Run a private-access write, translating ``InstanceNotPrivateError`` into the same
    ``GameError`` (400) every facilitator route surfaces instead of the 500 it would otherwise be.

    A facilitator route only makes sense on a privately-configured instance — a public one has no
    allowlist/join-token to mutate — and every ``instance_config`` write below raises the same
    error for that case, so this is the one place that translation happens.
    """
    try:
        return mutate()
    except instance_config.InstanceNotPrivateError as exc:
        raise GameError(IdentityErrorCode.INSTANCE_NOT_PRIVATE) from exc


def _access_out() -> FacilitatorAccessOut:
    """The current join-link settings, generating the token on first call (never rotated after)."""
    join_token = _or_not_private(instance_config.get_or_create_join_token)
    config = instance_config.load_instance_config()
    # get_or_create_join_token() just succeeded, which only happens for a privately-configured
    # instance, so re-reading here always finds the same PrivateAccess block.
    assert config is not None and isinstance(config.access, instance_config.PrivateAccess)
    return FacilitatorAccessOut(join_token=join_token, join_open=config.access.join_open)


@router.get("/access")
def get_access() -> FacilitatorAccessOut:
    """This instance's join-link settings — lazily generating the join token on first visit."""
    return _access_out()


@router.patch("/access", status_code=204)
def update_access(access_patch: FacilitatorAccessPatch) -> None:
    """Flip whether the join link currently admits new accounts."""
    _or_not_private(lambda: instance_config.set_join_open(access_patch.join_open))


def _require_private_slug() -> str:
    """This instance's slug, after confirming it is privately configured — translating "not
    private" into the same ``GameError`` every facilitator route uses.

    The roster is the run's membership in the lobby service, keyed by slug (ADR-0007, ADR-0009),
    not in ``instance.json`` any more — this only checks that file's
    *policy*, the one thing that still decides whether a roster applies at all.
    """
    try:
        config = instance_config.load_instance_config()
    except instance_config.InstanceConfigError as exc:
        raise GameError(IdentityErrorCode.INSTANCE_NOT_PRIVATE) from exc
    if config is None or not isinstance(config.access, instance_config.PrivateAccess):
        raise GameError(IdentityErrorCode.INSTANCE_NOT_PRIVATE)
    slug = instance_config.instance_slug()
    assert slug is not None  # a loaded config implies a configured slug
    return slug


@router.get("/roster")
def get_roster() -> FacilitatorRosterOut:
    """This instance's roster: every account allowed to enter it, whether or not it has yet."""
    slug = _require_private_slug()
    return FacilitatorRosterOut(members=[member.username for member in lobby_service().get_run_members(slug)])


@router.get("/roster/candidates")
def search_roster_candidates(prefix: Annotated[str, Query(min_length=1)]) -> RosterCandidatesOut:
    """Existing accounts whose username starts with ``prefix`` — the add control's lookup.

    Doesn't require this instance to be private (searching the server-wide account store doesn't
    touch its roster), so it skips :func:`_require_private_slug` — the add-control's own POST is
    where "this instance isn't private" would actually matter.
    """
    matches = lobby_service().search_accounts(prefix=prefix)
    return RosterCandidatesOut(usernames=[account.username for account in matches])


@router.post("/roster", status_code=204)
def add_to_roster(body: RosterAddIn) -> None:
    """Add an existing account to the roster.

    No freeform username strings: an account must already exist server-wide (a facilitator can
    only invite someone with an account, not conjure a name into the roster), which reuses the
    same ``USER_NOT_FOUND`` a login rejects an unknown username with. Idempotent — adding an
    already-joined account is a no-op.
    """
    account = lobby_service().get_account_by_username(body.username)
    if account is None:
        raise GameError(SharedErrorCode.USER_NOT_FOUND)
    slug = _require_private_slug()
    try:
        lobby_service().add_run_member(slug, account.account_id)
    except LobbyServiceRefusal as refusal:
        if refusal.code != LobbyServiceErrorCode.ROLE_CONFLICT:
            raise
        # body.username is this run's facilitator (or server-wide) — a facilitator administers a
        # run, it doesn't also join one as a player (ADR-0004).
        raise GameError(SharedErrorCode.INSTANCE_ACCESS_DENIED)


@router.delete("/roster/{username}", status_code=204)
def remove_from_roster(username: str) -> None:
    """Ban/remove: drop ``username``'s membership in this run.

    Revocation is eventual — it takes effect on the account's next entry check, not an instant
    kick of a live session (out of scope here, #677 if ever built) — and does not touch any
    ``Player`` already created. A no-op (still 204) if
    ``username`` names no account, or isn't on the roster — matching the old allowlist's
    idempotency.
    """
    slug = _require_private_slug()
    account = lobby_service().get_account_by_username(username)
    if account is None:
        return
    lobby_service().remove_run_member(slug, account.account_id)
