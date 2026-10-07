"""Workshop's application factory: the app a Workshop Run's backend serves (#994).

It has no game engine, no tick loop and none of the persistent world's routes. It serves the shared
``/run``, join-link and facilitator routes, Workshop's own routes, its own Socket.IO server and a
``/healthz`` probe, and it holds the Run's :class:`~energetica.workshop.session.WorkshopSession`
on ``app.state`` for the life of the process. ``energetica.entry.create_instance_app`` chooses
between this and the persistent world's app.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool

from energetica.identity import accounts, instance_config
from energetica.identity.instance_config import InstanceConfig
from energetica.identity.facilitator import router as facilitator_router
from energetica.identity.join import router as join_router
from energetica.identity.run import run_router
from energetica.kernel.error_envelope import install_error_handlers
from energetica.kernel.version import backend_version, frontend_version
from energetica.workshop.realtime import invalidate_session, setup_socketio
from energetica.workshop.routes import router as workshop_router
from energetica.workshop.session import Clock, WorkshopSession, utc_now

logger = logging.getLogger(__name__)

# Where the session is saved, relative to the instance directory that systemd pins as the working
# directory. Beside the persistent world's files, which a Workshop Run never creates.
DEFAULT_SESSION_PATH = Path("instance/workshop_session.json")

# Where deploy-instance.sh puts the built app bundle. Restated from the persistent world's health
# route, which Workshop may not import.
APP_BUNDLE_SUBPATH = "dist-app"

# How often the app checks whether an Investment phase's time has run out, so its selections can be
# bought (#999). Players see the purchase within this long of the countdown reaching zero.
PURCHASE_CHECK_INTERVAL_SECONDS = 1.0


def create_workshop_app(
    config: InstanceConfig | None = None,
    *,
    session_path: Path = DEFAULT_SESSION_PATH,
    rm_instance: bool = False,
    schema_only: bool = False,
    clock: Clock = utc_now,
) -> FastAPI:
    """Build the Workshop app for the Run ``config`` describes, reopening its saved session.

    ``rm_instance`` deletes the saved session first, so the Run starts over. ``schema_only`` builds
    the routes alone, without a session, for generating the OpenAPI schema; ``config`` is then not
    needed. ``clock`` gives the current time that phase timers count from.
    """
    app = FastAPI(title="Energetica Workshop", lifespan=_lifespan)
    install_error_handlers(app)
    app.include_router(run_router("workshop"), prefix="/api/v1")
    # A private Run admits accounts through the join link and the facilitator's roster.
    app.include_router(join_router, prefix="/api/v1")
    app.include_router(facilitator_router, prefix="/api/v1")
    app.include_router(workshop_router, prefix="/api/v1")
    if schema_only:
        return app

    if config is None:
        raise ValueError("a Workshop app needs its Run's config")
    if rm_instance:
        session_path.unlink(missing_ok=True)
    app.state.workshop_session = WorkshopSession.open(config, session_path, clock=clock)
    setup_socketio(app)
    started_at = time.monotonic()

    @app.get("/healthz", include_in_schema=False)
    def healthz() -> dict:
        """Deployed-version probe. A Workshop Run has no tick loop, so serving at all means ``ok``."""
        session: WorkshopSession = app.state.workshop_session
        return {
            "status": "ok",
            "version": {"backend": backend_version(), "frontend": frontend_version(APP_BUNDLE_SUBPATH)},
            "uptime_s": int(time.monotonic() - started_at),
            "workshop": {"checkpoint": session.checkpoint.model_dump(), "players": len(session.network.players())},
        }

    return app


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    accounts.init_db()
    # Publish this Run's public fragment so the lobby can list it, as the persistent world does.
    instance_config.publish_on_startup()
    # An app built only for its OpenAPI schema has no session, so nothing to buy.
    if not hasattr(app.state, "workshop_session"):
        yield
        return
    purchases = asyncio.create_task(_buy_selections_when_due(app))
    try:
        yield
    finally:
        purchases.cancel()


async def _buy_selections_when_due(app: FastAPI) -> None:
    """Buy every player's selection once the Investment phase's time runs out, and tell every open page.

    The session does not act on its own when a timer runs out, so this checks for it. The
    facilitator's advance also buys any selection still waiting, which covers a restart or a failed
    save in between.
    """
    session: WorkshopSession = app.state.workshop_session
    while True:
        await asyncio.sleep(PURCHASE_CHECK_INTERVAL_SECONDS)
        try:
            # Waits on the session's lock and writes the session file, so it runs on a worker thread.
            bought = await run_in_threadpool(session.buy_selections)
        except Exception:
            logger.exception("Could not buy the Workshop selections. Retrying.")
            continue
        if not bought:
            continue
        try:
            await invalidate_session(app)
        except Exception:
            # The purchase stands. Open pages show it on their next read, and this loop must keep
            # running for the next Investment phase.
            logger.exception("Bought the Workshop selections but could not tell the open pages.")
