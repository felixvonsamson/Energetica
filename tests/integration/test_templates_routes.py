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

    # The bare /app/assets (no trailing slash, no filename) must also 404 —
    # the guard should be symmetric across the assets boundary.
    response = client.get("/app/assets")
    assert response.status_code == 404
