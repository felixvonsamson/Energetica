"""Guards the whole HTTP surface a fully-built instance exposes.

After the Phase 5 static cutover and the lobby cutover, FastAPI is meant to serve only
`/api/*` and `/socket.io`, plus the `/healthz` probe Apache and the deploy scripts poll
(see docs/architecture/static-serving-and-deployment.md § What FastAPI keeps).
`test_templates_routes.py` checks that specific retired paths return 404; this file checks
the inverse — that nothing *else* has crept back in.

These tests build the real app rather than the `schema_only=True` one the other route tests
use. `create_app` registers part of its surface after the `schema_only` early return, so a
`schema_only` app cannot see that part at all: that is how a route serving a file deleted
nine months earlier survived unnoticed (#948). It was absent from the OpenAPI schema too,
so `bun run generate-types` never surfaced it either.
"""

from __future__ import annotations

from fastapi import FastAPI

from energetica import create_app

PORT = 8002

# FastAPI mounts these itself for the interactive API docs.
FASTAPI_BUILTIN_PATHS = frozenset({"/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"})

# Everything the instance is documented to answer outside the versioned API.
ALLOWED_NON_API_PATHS = frozenset({"/socket.io", "/healthz"})


def _app() -> FastAPI:
    return create_app(rm_instance=True, skip_adding_handlers=True, env="dev", port=PORT)


def _route_paths(app: FastAPI) -> set[str]:
    return {path for route in app.routes if (path := getattr(route, "path", None))}


def test_no_routes_outside_api_socketio_and_healthz() -> None:
    """A route outside the documented surface is either dead or belongs behind /api/v1."""
    unexpected = {
        path
        for path in _route_paths(_app())
        if not path.startswith("/api/") and path not in FASTAPI_BUILTIN_PATHS | ALLOWED_NON_API_PATHS
    }

    assert unexpected == set()


def test_documented_non_api_routes_are_present() -> None:
    """The allowlist above is only meaningful if those routes actually exist."""
    assert ALLOWED_NON_API_PATHS <= _route_paths(_app())
