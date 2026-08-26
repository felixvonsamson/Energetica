"""Facilitator instance-admin surface: join link and the open/closed toggle (#1020).

Exposes #1019's private-access write path (``instance_config``'s ``get_or_create_join_token`` /
``set_join_open``) over HTTP for the facilitator settings page. Every route here is instance-wide,
not tied to *which* admin is calling, so the auth gate is a router-level dependency rather than a
per-route parameter each handler would otherwise ignore.
"""

from fastapi import APIRouter, Depends

from energetica import instance_config
from energetica.game_error import GameError, GameExceptionType
from energetica.schemas.facilitator import FacilitatorAccessOut, FacilitatorAccessPatch
from energetica.utils.auth import get_admin_user

router = APIRouter(prefix="/facilitator", tags=["Facilitator"], dependencies=[Depends(get_admin_user)])


def _access_out() -> FacilitatorAccessOut:
    """The current join-link settings, generating the token on first call (never rotated after).

    A facilitator route only makes sense on a privately-configured instance — a public one has no
    allowlist/join-token to show — so ``InstanceNotPrivateError`` is translated into a ``GameError``
    (400) rather than the 500 it would otherwise surface as.
    """
    try:
        join_token = instance_config.get_or_create_join_token()
    except instance_config.InstanceNotPrivateError as exc:
        raise GameError(GameExceptionType.INSTANCE_NOT_PRIVATE) from exc
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
def update_access(request_data: FacilitatorAccessPatch) -> None:
    """Flip whether the join link currently admits new accounts."""
    try:
        instance_config.set_join_open(request_data.join_open)
    except instance_config.InstanceNotPrivateError as exc:
        raise GameError(GameExceptionType.INSTANCE_NOT_PRIVATE) from exc
