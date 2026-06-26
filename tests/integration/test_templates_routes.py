"""Integration tests for the FastAPI root-level routes after the Phase 5 cutover.

Apache now serves every static asset and SPA shell directly from disk (see
docs/architecture/static-serving-and-deployment.md § Request routing). FastAPI
keeps only the dynamic root routes — `/logout` — plus `/api/*` and `/socket.io`.
Everything that used to be served by FastAPI (`/`, `/app/*`, `/landing-page`,
the `/static` mount, `/service-worker.js`, `/manifest.json`, the legacy
`/sign-up` → `/app/sign-up` redirect) must now 404 from uvicorn so a
misconfigured vhost surfaces loudly instead of being silently papered over by
FastAPI.
"""

import pytest
from fastapi.testclient import TestClient

from energetica import create_app


@pytest.fixture
def client() -> TestClient:
    app = create_app(env="dev", schema_only=True)
    return TestClient(app)


def test_logout_redirects_to_login(client: TestClient) -> None:
    """/logout stays on FastAPI — it clears server-side session state."""
    response = client.get("/logout", follow_redirects=False)
    assert response.status_code in (302, 303, 307)
    assert response.headers["location"] == "/app/login"


@pytest.mark.parametrize(
    "path",
    [
        "/",  # render_root removed — Apache RedirectMatch ^/$ → /app/
        "/landing-page",  # render_landing_page removed — landing is Apache-served
        "/app/login",  # render_react_app removed — Apache FallbackResource serves /app/*
        "/app/dashboard",
        "/app/assets/index.js",  # never the HTML shell; now simply not a FastAPI route
        "/sign-up",  # legacy 301 removed — optional Apache RedirectMatch handles stale links
        "/static/app/index.html",  # StaticFiles mount removed
        "/service-worker.js",  # Apache serves it directly
        "/manifest.json",  # Apache serves it directly
    ],
)
def test_static_and_page_routes_are_gone(client: TestClient, path: str) -> None:
    """All static/SPA serving moved to Apache — FastAPI returns 404 for them."""
    response = client.get(path, follow_redirects=False)
    assert response.status_code == 404
