"""Facilitator instance-admin surface: join link/toggle (#1020) and the roster page (#1022).

Exposes #1019's private-access write path (``instance_config``'s ``get_or_create_join_token`` /
``set_join_open`` / ``add_allowed_username`` / ``remove_allowed_username``) over HTTP. Every route
here is instance-wide, not tied to *which* admin is calling, so the auth gate is a router-level
dependency rather than a per-route parameter each handler would otherwise ignore.
"""

from typing import Annotated, Callable, TypeVar

from fastapi import APIRouter, Depends, Query

from energetica import accounts, instance_config
from energetica.database.player import Player
from energetica.game_error import GameError, GameExceptionType
from energetica.schemas.facilitator import (
    FacilitatorAccessOut,
    FacilitatorAccessPatch,
    FacilitatorRosterOut,
    RosterAddIn,
    RosterCandidatesOut,
)
from energetica.utils.auth import get_facilitator

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
        raise GameError(GameExceptionType.INSTANCE_NOT_PRIVATE) from exc


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


def _private_access() -> instance_config.PrivateAccess:
    """This instance's private-access block, translating "not private" into the same
    ``GameError`` every facilitator route uses.
    """
    try:
        config = instance_config.load_instance_config()
    except instance_config.InstanceConfigError as exc:
        raise GameError(GameExceptionType.INSTANCE_NOT_PRIVATE) from exc
    if config is None or not isinstance(config.access, instance_config.PrivateAccess):
        raise GameError(GameExceptionType.INSTANCE_NOT_PRIVATE)
    return config.access


@router.get("/roster")
def get_roster() -> FacilitatorRosterOut:
    """This instance's roster, split into joined (a settled ``Player`` already exists) vs invited
    (allowlisted, no entry yet).
    """
    access = _private_access()
    joined: list[str] = []
    invited: list[str] = []
    for username in access.allowed_usernames:
        bucket = joined if next(Player.filter_by(username=username), None) is not None else invited
        bucket.append(username)
    return FacilitatorRosterOut(joined=joined, invited=invited)


@router.get("/roster/candidates")
def search_roster_candidates(prefix: Annotated[str, Query(min_length=1)]) -> RosterCandidatesOut:
    """Existing accounts whose username starts with ``prefix`` — the add control's lookup.

    Doesn't require this instance to be private (searching the server-wide account store doesn't
    touch its allowlist), so it skips :func:`_private_access` — the add-control's own POST is
    where "this instance isn't private" would actually matter.
    """
    matches = accounts.search_accounts(prefix=prefix)
    return RosterCandidatesOut(usernames=[account.username for account in matches])


@router.post("/roster", status_code=204)
def add_to_roster(body: RosterAddIn) -> None:
    """Add an existing account to the roster.

    No freeform username strings: an account must already exist server-wide (a facilitator can
    only invite someone with an account, not conjure a name into the allowlist), which reuses the
    same ``USER_NOT_FOUND`` a login rejects an unknown username with.
    """
    if accounts.get_account_by_username(body.username) is None:
        raise GameError(GameExceptionType.USER_NOT_FOUND)
    _or_not_private(lambda: instance_config.add_allowed_username(body.username))


@router.delete("/roster/{username}", status_code=204)
def remove_from_roster(username: str) -> None:
    """Ban/remove: drop ``username`` from the allowlist.

    Revocation is eventual — it takes effect on the account's next entry check, not an instant
    kick of a live session (out of scope here, #677 if ever built). A no-op (still 204) if
    ``username`` wasn't on the allowlist, matching :func:`instance_config.remove_allowed_username`'s
    own idempotency.
    """
    _or_not_private(lambda: instance_config.remove_allowed_username(username))
