"""Integration tests for SPA-serving routes in energetica.routers.templates."""

from fastapi.testclient import TestClient

from energetica import create_app


def test_app_assets_path_returns_404_not_html_shell() -> None:
    """Regression: /app/assets/* must not serve the SPA HTML shell.

    Built assets are served from /static/app/assets/. Returning the HTML shell
    for /app/assets/missing.js made the browser try to execute HTML as JS and
    masked real 404s during PR #791 verification.
    """
    app = create_app(env="dev", schema_only=True)
    client = TestClient(app)

    response = client.get("/app/assets/does-not-exist.js")
    assert response.status_code == 404


def test_app_spa_route_still_serves_html_shell() -> None:
    """/app/<spa-route> must still serve the HTML shell so client routing works."""
    app = create_app(env="dev", schema_only=True)
    client = TestClient(app)

    response = client.get("/app/some-client-side-route")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
