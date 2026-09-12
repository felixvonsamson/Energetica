"""System-managed Workshop Run setup (#992 §11, #993).

Placing a joining account into a Workshop Run is fully automatic. There is no player-initiated
"join a network" action the way free play has (``energetica.utils.network_helpers.join_network``),
and no per-player tile-pick settle flow either (``energetica.utils.misc.initialize_player``) —
Workshop has no map/tile system for a player to pick a location on. :func:`join_workshop_run` is
the single system-managed replacement for both: it constructs the joining account's
:class:`~energetica.workshop.player.WorkshopPlayer` and adds it to the Run's one shared
:class:`~energetica.workshop.network.WorkshopNetwork` in the same step.
"""

from __future__ import annotations

from energetica.accounts import Account
from energetica.instance_config import InstanceConfig
from energetica.workshop.network import get_or_create_shared_network
from energetica.workshop.player import WorkshopPlayer


class NotAWorkshopRunError(RuntimeError):
    """Raised when Workshop-only setup is attempted against a non-Workshop instance config.

    ``config.workshop is not None`` is the sole discriminator for "this Run is a Workshop Run"
    (#992 §10) — there is no separate mode flag that could drift out of sync with it, so this is
    the one gate every Workshop-specific entry point checks.
    """


def join_workshop_run(account: Account, config: InstanceConfig) -> WorkshopPlayer:
    """Place ``account`` into the Workshop Run described by ``config``, or return its existing
    :class:`~energetica.workshop.player.WorkshopPlayer` unchanged if it already joined.

    Unlike the persistent world's player-initiated ``join_network``, this is automatic,
    unconditional, and — because it is a distinct, system-driven assignment path rather than that
    existing join call — not subject to ``NETWORK_MEMBER_LIMIT`` at all (that cap was confirmed to
    gate only the one existing join call, not Run membership generally; see #990).

    Raises :class:`NotAWorkshopRunError` if ``config`` is not a Workshop Run's config.

    Idempotent per account: a retried call (e.g. the future join/settle route retrying a failed
    request) must not hand the same account a second Run identity and a second shared-Network
    entry, so an existing ``WorkshopPlayer`` for ``account`` is returned as-is instead of
    constructing another one.
    """
    if config.workshop is None:
        raise NotAWorkshopRunError(f"instance is not a Workshop Run: {config.name!r}")
    existing = next(WorkshopPlayer.filter_by(account_id=account.account_id), None)
    if existing is not None:
        return existing
    network = get_or_create_shared_network()
    player = WorkshopPlayer(account_id=account.account_id, username=account.username)
    player.network = network
    network.members.append(player)
    return player
