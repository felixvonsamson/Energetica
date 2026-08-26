"""Public join-link surface (#1021): the visitor-facing counterpart to #1020's facilitator page.

Reachable by anyone holding a valid token — no ``get_admin_user``/``get_settled_player`` gate here,
the unguessable token in the URL *is* the authorization. Resolves a token to this instance's name
and open/closed state (``GET``, safe to call before the visitor is access-allowed or even signed
in), and lets an already-signed-in visitor confirm joining (``POST``), which appends their
username to the private instance's allowlist via #1019's write path. Entry into the game itself
still goes through the existing, unmodified entry gate (``/auth/me`` → ``resolve_entry_user`` /
``_enforce_instance_access`` in ``routers.auth``) — this router only ever grows the allowlist that
gate reads.
"""

import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from energetica import instance_config
from energetica.accounts import Account
from energetica.game_error import GameError, GameExceptionType
from energetica.schemas.join import JoinLinkOut
from energetica.utils.auth import get_current_account

router = APIRouter(prefix="/join", tags=["Join"])


def _resolve(token: str) -> tuple[str, instance_config.PrivateAccess]:
    """This instance's name and private-access block, if ``token`` is its current join token.

    A wrong token, an unconfigured/public instance, or an instance with no join token generated
    yet all collapse to the same ``JOIN_LINK_INVALID`` — there is nothing case-specific a visitor
    could act on, and distinguishing them would only help someone probing for a valid link.
    ``compare_digest`` avoids a timing oracle on the comparison.
    """
    try:
        config = instance_config.load_instance_config()
    except instance_config.InstanceConfigError as exc:
        raise GameError(GameExceptionType.JOIN_LINK_INVALID) from exc
    if config is None or not isinstance(config.access, instance_config.PrivateAccess):
        raise GameError(GameExceptionType.JOIN_LINK_INVALID)
    access = config.access
    if access.join_token is None or not secrets.compare_digest(access.join_token, token):
        raise GameError(GameExceptionType.JOIN_LINK_INVALID)
    return config.name, access


@router.get("/{token}")
def get_join_link(token: str, account: Annotated[Account | None, Depends(get_current_account)]) -> JoinLinkOut:
    """What this join link offers, and whether the visitor already has a session to join with."""
    instance_name, access = _resolve(token)
    return JoinLinkOut(
        instance_name=instance_name,
        join_open=access.join_open,
        viewer_username=account.username if account is not None else None,
    )


@router.post("/{token}", status_code=204)
def confirm_join(token: str, account: Annotated[Account | None, Depends(get_current_account)]) -> None:
    """Confirm joining: append the signed-in visitor's username to the allowlist.

    Requires an SSO session (``get_current_account``, not ``get_settled_player`` — the whole point
    is this runs *before* the visitor is access-allowed, so no local ``User`` need exist yet) but
    deliberately does not go through ``_enforce_instance_access``: granting access is this
    endpoint's job, not a precondition for reaching it. Checks identity before instance state
    (mirrors ``get_admin_user``/``get_settled_player``'s "who, then what" order elsewhere in this
    codebase) and re-checks ``join_open`` server-side rather than trusting the page's last
    ``GET``, so a facilitator flipping the toggle mid-visit is the outcome that wins, not a stale
    client.
    """
    if account is None:
        # Matches resolve_entry_user's convention: no/invalid session is a 401, not a 400
        # GameError — this is a plain auth failure, not a game-domain rejection.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GameExceptionType.NOT_AUTHENTICATED)
    _, access = _resolve(token)
    if not access.join_open:
        raise GameError(GameExceptionType.JOIN_LINK_CLOSED)
    instance_config.add_allowed_username(account.username)
