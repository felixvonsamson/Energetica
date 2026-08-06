"""Guards the whole HTTP surface a fully-built instance exposes.

FastAPI answers only `/api/*`, `/socket.io`, and the `/healthz` probe (see
docs/architecture/static-serving-and-deployment.md § What FastAPI keeps); Apache serves
every static asset and SPA shell. `test_templates_routes.py` checks that specific retired
paths return 404. This file checks the inverse: that nothing else is registered.

These tests build the real app, not the `schema_only=True` app the other route tests build.
`create_app` registers part of its surface after the `schema_only` early return, so a
schema-only app cannot see that part at all. That is how `/apple-app-site-association` went
on serving a file that no longer existed (#948) — it was absent from the OpenAPI schema too,
so `bun run generate-types` never showed it either.
"""

from __future__ import annotations

import pytest

from energetica import create_app

# FastAPI mounts these itself for the interactive API docs.
FASTAPI_BUILTIN_PATHS = frozenset({"/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"})

# Everything the instance is documented to answer outside the versioned API.
ALLOWED_NON_API_PATHS = frozenset({"/socket.io", "/healthz"})


@pytest.fixture(scope="module")
def route_paths() -> set[str]:
    """Every path the real app registers. Module-scoped because building the app is the slow part."""
    app = create_app(rm_instance=True, skip_adding_handlers=True, env="dev")
    return {path for route in app.routes if (path := getattr(route, "path", None))}


def test_no_routes_outside_api_socketio_and_healthz(route_paths: set[str]) -> None:
    """A route outside the documented surface is either dead or belongs behind /api/v1."""
    allowed = FASTAPI_BUILTIN_PATHS | ALLOWED_NON_API_PATHS
    unexpected = {path for path in route_paths if not path.startswith("/api/") and path not in allowed}

    assert unexpected == set()


def test_documented_non_api_routes_are_present(route_paths: set[str]) -> None:
    """The allowlist above only means something if those routes actually exist."""
    assert ALLOWED_NON_API_PATHS <= route_paths
