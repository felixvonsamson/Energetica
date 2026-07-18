"""Mint + publish the recap at the ``active → freeze`` transition (T5, #863).

This is the game-side half of the recap: it reads the live final state (``Player.all()`` + the
instance config) and publishes the frozen tombstone via :mod:`energetica.instance_config`. It is kept
out of ``instance_config`` itself so that leaf stays free of the game domain (the module-boundary
rule) — the publish/load *primitives* live there, the ``Player``-reading *orchestration* lives here.

The hook fires from ``tick_execution.state_update`` on every freeze/ended tick, but
:func:`mint_recap_if_needed` mints only once (guarded by file existence), so the frozen photograph is
taken at the first freeze tick and never overwritten by a later restart. Freeze is read-only and the
sim is halted, so the state is final — mint-at-freeze *is* the final leaderboard.
"""

from __future__ import annotations

import logging

from energetica import instance_config
from energetica.database.player import Player
from energetica.schemas.recap import Recap

logger = logging.getLogger(__name__)


def build_recap() -> Recap | None:
    """Project this instance's live final state into a recap, or ``None`` when unconfigured.

    Returns ``None`` (nothing to mint) for a dev/legacy instance with no slug or no on-disk config —
    the same "unconfigured ⇒ no lifecycle" stance the phase read takes.
    """
    slug = instance_config.instance_slug()
    if slug is None:
        return None
    config = instance_config.load_instance_config()
    if config is None:
        return None
    return Recap.from_players(slug=slug, config=config, players=Player.all())


def mint_recap() -> None:
    """Build and publish the recap, **overwriting** any existing artifact — the force-overwrite primitive.

    Unconditional on purpose: it regenerates the recap from current state regardless of what is already
    on disk. The reachable baseline admin-regenerate path is manual delete + auto-remint (``rm`` the
    file, the next freeze tick re-mints via :func:`mint_recap_if_needed`); this is the underlying
    primitive a future admin control can call to force a regenerate without the delete step.
    """
    recap = build_recap()
    if recap is None:
        logger.info("skipping recap mint: instance is unconfigured (no slug / no instance.json)")
        return
    instance_config.publish_recap(recap)
    logger.info("published recap for %s (%d players)", recap.slug, recap.player_count)


def mint_recap_if_needed() -> None:
    """Mint the recap once, at the ``active → freeze`` edge — the tick-loop hook.

    Idempotent and re-runnable: file-existence is the mint-once flag, so this no-ops on every freeze
    tick after the first and across a restart in freeze, while an admin deleting ``recaps/{slug}.json``
    triggers a re-mint on the next tick. Best-effort — a mint failure is logged and swallowed so it can
    never break the tick loop (the same stance ``instance_config.publish`` takes for the fragment).
    """
    slug = instance_config.instance_slug()
    if slug is None or instance_config.recap_exists(slug):
        return
    try:
        mint_recap()
    except Exception:  # noqa: BLE001 — best-effort: minting must never break the tick loop
        logger.exception("failed to mint recap for %s", slug)
