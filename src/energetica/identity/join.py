"""Public join-link surface (#1021): the visitor-facing counterpart to #1020's facilitator page.

Reachable by anyone holding a valid token — no ``get_facilitator``/``get_settled_player`` gate here,
the unguessable token in the URL *is* the authorization. Resolves a token to this instance's name
and open/closed state (``GET``, safe to call before the visitor is access-allowed or even signed
in), and lets an already-signed-in visitor confirm joining (``POST``), which joins them to the run
through the lobby service (ADR-0007, ADR-0009) — the same idempotent join the public-run picker and
the facilitator roster's add both use. Entry into the game itself still goes through the entry gate
(``/auth/me`` → ``resolve_entry`` / ``_enforce_instance_access`` in ``identity.web``), which reads
that same membership.

Both the persistent world and Workshop serve these routes (#1138).
"""

import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from energetica.identity import instance_config
from energetica.identity.game_error import IdentityErrorCode
from energetica.identity.lobby_service_client import LobbyServiceRefusal
from energetica.identity.schemas.join import JoinLinkOut, Viewer
from energetica.identity.schemas.lobby_service import LobbyServiceErrorCode
from energetica.identity.web import Standing, get_current_account, get_standing, lobby_service
from energetica.identity.account import Account
from energetica.kernel.game_error import GameError, SharedErrorCode

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
        raise GameError(IdentityErrorCode.JOIN_LINK_INVALID) from exc
    if config is None or not isinstance(config.access, instance_config.PrivateAccess):
        raise GameError(IdentityErrorCode.JOIN_LINK_INVALID)
    access = config.access
    if access.join_token is None or not secrets.compare_digest(access.join_token, token):
        raise GameError(IdentityErrorCode.JOIN_LINK_INVALID)
    return config.name, access


@router.get("/{token}")
def get_join_link(token: str, standing: Annotated[Standing | None, Depends(get_standing)]) -> JoinLinkOut:
    """What this join link offers, and whether the visitor already has a session to join with."""
    instance_name, access = _resolve(token)
    viewer = None
    if standing is not None:
        if standing.role == "facilitator":
            membership = "facilitator"
        elif standing.joined:
            membership = "player"
        else:
            membership = None
        viewer = Viewer(username=standing.account.username, membership=membership)
    return JoinLinkOut(instance_name=instance_name, join_open=access.join_open, viewer=viewer)


@router.post("/{token}", status_code=204)
def confirm_join(token: str, account: Annotated[Account | None, Depends(get_current_account)]) -> None:
    """Confirm joining: join the signed-in visitor to this run through the lobby service.

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
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, SharedErrorCode.NOT_AUTHENTICATED)
    _, access = _resolve(token)
    if not access.join_open:
        raise GameError(IdentityErrorCode.JOIN_LINK_CLOSED)
    slug = instance_config.instance_slug()
    assert slug is not None  # _resolve() only succeeds for a slug-configured, privately-set-up instance
    try:
        lobby_service().add_run_member(slug, account.account_id)
    except LobbyServiceRefusal as refusal:
        if refusal.code != LobbyServiceErrorCode.ROLE_CONFLICT:
            raise
        # account is this run's facilitator (or server-wide) — a facilitator administers a run,
        # it doesn't also join one as a player (ADR-0004). There is no in-app way to reach this
        # (a facilitator has no reason to visit their own join link), but fail closed rather than
        # 500 if it ever happens.
        raise GameError(SharedErrorCode.INSTANCE_ACCESS_DENIED)
