"""Integration tests for the FastAPI root-level routes after the Phase 5 cutover.

Apache now serves every static asset and SPA shell directly from disk (see
docs/architecture/static-serving-and-deployment.md § Request routing). After the
lobby cutover (#817) FastAPI keeps only `/api/*` and `/socket.io`: the instance no
longer mints or clears sessions (login/signup/logout/change-password are the lobby's,
ADR-0002/0003), so the legacy root `/logout` redirect was retired too. Everything that
used to be served by FastAPI (`/`, `/app/*`, `/landing-page`, `/logout`, the `/static`
mount, `/service-worker.js`, `/manifest.json`, the legacy `/sign-up` → `/app/sign-up`
redirect) must now 404 from uvicorn so a misconfigured vhost surfaces loudly instead of
being silently papered over by FastAPI.
"""

import pytest
from fastapi.testclient import TestClient

from energetica import create_app


@pytest.fixture
def client() -> TestClient:
    app = create_app(env="dev", schema_only=True)
    return TestClient(app)


@pytest.mark.parametrize(
    "path",
    [
        "/",  # render_root removed — Apache RedirectMatch ^/$ → /app/
        "/landing-page",  # render_landing_page removed — landing is Apache-served
        "/app/login",  # render_react_app removed — Apache FallbackResource serves /app/*
        "/app/dashboard",
        "/app/assets/index.js",  # never the HTML shell; now simply not a FastAPI route
        "/logout",  # retired with the lobby cutover — global logout is the lobby's (#817)
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


def test_unauthenticated_protected_get_returns_json_401_not_spa_redirect(client: TestClient) -> None:
    """An unauthenticated GET to a protected API endpoint returns a JSON 401 — never a 303
    redirect to /app/login.

    FastAPI serves no SPA shell after Phase 5, so a redirect can only dump a fetch client onto
    Apache's (or, in dev, Vite's) index.html, which `response.json()` then chokes on with
    "Unexpected token '<', "<!DOCTYPE"...". The SPA owns the redirect to /app/login client-side
    (routes/__root.tsx), driven by /auth/me; the API only ever speaks JSON.
    """
    response = client.get("/api/v1/achievements", follow_redirects=False)
    assert response.status_code == 401
    assert "application/json" in response.headers["content-type"]
