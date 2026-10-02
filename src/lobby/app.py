"""The lobby FastAPI application factory.

Kept tiny and engine-free: it wires the two routers under ``/api/v1`` and installs the shared error
envelope (:mod:`energetica.kernel.error_envelope`) so error responses match the frontend's error
handling.
"""

from __future__ import annotations

from fastapi import FastAPI

from energetica.kernel.error_envelope import install_error_handlers
from energetica.kernel.version import backend_version, frontend_version
from lobby.routers import auth_router, lobby_router

# The lobby serves its SPA from dist-lobby (see scripts/deploy-lobby.sh), so that is where its
# frontend build stamp lives — relative to the repo/instance root that version.py resolves against.
LOBBY_BUNDLE_SUBPATH = "dist-lobby"


def create_lobby_app(*, schema_only: bool = False) -> FastAPI:
    """Build the lobby app. ``schema_only`` is accepted for symmetry with the game's ``create_app``
    (unused today: the lobby reuses the game's generated types, so it needs no schema export).
    """
    app = FastAPI(title="Energetica Lobby")

    install_error_handlers(app)

    @app.get("/healthz", include_in_schema=False)
    def healthz() -> dict:
        """Deployed-version probe for the lobby.

        The lobby is engine-free, so this reports only liveness and the deployed version of
        each half — no tick counters or game state (unlike the instance ``/healthz``). The
        deploy script and drift-check tooling read the same "version" shape from both.
        """
        return {
            "status": "ok",
            "version": {
                "backend": backend_version(),
                "frontend": frontend_version(LOBBY_BUNDLE_SUBPATH),
            },
        }

    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(lobby_router, prefix="/api/v1")

    return app
