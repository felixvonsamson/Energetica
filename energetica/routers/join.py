"""Public join-link surface (#1021): the visitor-facing counterpart to #1020's facilitator page.

Reachable by anyone holding a valid token — no ``get_facilitator``/``get_settled_player`` gate here,
the unguessable token in the URL *is* the authorization. Resolves a token to this instance's name
and open/closed state (``GET``, safe to call before the visitor is access-allowed or even signed
in), and lets an already-signed-in visitor confirm joining (``POST``), which records the join in
``accounts.db``'s ``instance_membership`` (#1030 follow-up, ADR-0007) — the same write
``accounts.record_join`` the public-run picker join and the facilitator roster's add both use.
Entry into the game itself still goes through the existing, unmodified entry gate (``/auth/me`` →
``resolve_entry_account`` / ``_enforce_instance_access`` in ``routers.auth``), which now reads
that same table.
"""

import secrets
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from energetica import accounts, instance_config
from energetica.accounts import Account
from energetica.game_error import GameError, GameExceptionType
from energetica.schemas.join import JoinLinkOut
from energetica.utils.auth import get_current_account
from energetica.utils.misc import record_join_reconciling_settlement

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
    """Confirm joining: record the signed-in visitor's join in ``accounts.db``.

    Requires an SSO session (``get_current_account``, not ``get_settled_player`` — the whole point
    is this runs *before* the visitor is access-allowed, so no membership row need exist yet) but
    deliberately does not go through ``_enforce_instance_access``: granting access is this
    endpoint's job, not a precondition for reaching it. Checks identity before instance state
    (mirrors ``get_facilitator``/``get_settled_player``'s "who, then what" order elsewhere in this
    codebase) and re-checks ``join_open`` server-side rather than trusting the page's last
    ``GET``, so a facilitator flipping the toggle mid-visit is the outcome that wins, not a stale
    client.
    """
    if account is None:
        # Matches resolve_entry_account's convention: no/invalid session is a 401, not a 400
        # GameError — this is a plain auth failure, not a game-domain rejection.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GameExceptionType.NOT_AUTHENTICATED)
    _, access = _resolve(token)
    if not access.join_open:
        raise GameError(GameExceptionType.JOIN_LINK_CLOSED)
    slug = instance_config.instance_slug()
    assert slug is not None  # _resolve() only succeeds for a slug-configured, privately-set-up instance
    try:
        record_join_reconciling_settlement(
            account_id=account.account_id, slug=slug, joined_at=datetime.now(timezone.utc).isoformat()
        )
    except accounts.MembershipRoleConflictError:
        # account is this run's facilitator (or server-wide) — a facilitator administers a run,
        # it doesn't also join one as a player (ADR-0004). There is no in-app way to reach this
        # (a facilitator has no reason to visit their own join link), but fail closed rather than
        # 500 if it ever happens.
        raise GameError(GameExceptionType.INSTANCE_ACCESS_DENIED)
