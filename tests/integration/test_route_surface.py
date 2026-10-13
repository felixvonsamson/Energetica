"""Guards the whole HTTP surface each backend app exposes: freeplay, Workshop and the lobby.

FastAPI answers only `/api/*`, `/socket.io`, and the `/healthz` probe (see
docs/architecture/static-serving-and-deployment.md § What FastAPI keeps); Apache serves
every static asset and SPA shell. `test_templates_routes.py` checks that specific retired
paths return 404. This file checks the inverse: that nothing else is registered.

Each app's API routes are pinned below, so adding or removing a route means editing this file.
Each app's OpenAPI schema, which `bun run generate-types` turns into that app's types file, must
list exactly the same routes.

These tests build the real apps, not the `schema_only=True` apps the other route tests build.
`create_app` registers part of its surface after the `schema_only` early return, so a
schema-only app cannot see that part at all. That is how `/apple-app-site-association` went
on serving a file that no longer existed (#948) — it was absent from the OpenAPI schema too,
so `bun run generate-types` never showed it either.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType

import pytest
from fastapi import FastAPI
from fastapi.routing import APIRoute

from energetica.freeplay.app import create_app
from energetica.identity.instance_config import InstanceConfig
from energetica.workshop.app import create_workshop_app
from lobby import create_lobby_app

_GENERATOR = Path(__file__).resolve().parents[2] / "scripts" / "generate_openapi_schema.py"

APPS = ("freeplay", "workshop", "lobby")

# FastAPI mounts these itself for the interactive API docs.
FASTAPI_BUILTIN_PATHS = frozenset({"/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"})

# Everything each app is documented to answer outside the versioned API.
NON_API_PATHS = {
    "freeplay": frozenset({"/socket.io", "/healthz"}),
    "workshop": frozenset({"/socket.io", "/healthz"}),
    "lobby": frozenset({"/healthz"}),
}

# The join and facilitator routes. They are defined once in the identity layer and mounted by both
# Instance apps, so a Run in either mode can admit players through a join link and a roster.
IDENTITY_ROUTES = frozenset(
    {
        "GET /api/v1/join/{token}",
        "POST /api/v1/join/{token}",
        "GET /api/v1/facilitator/access",
        "PATCH /api/v1/facilitator/access",
        "GET /api/v1/facilitator/roster",
        "GET /api/v1/facilitator/roster/candidates",
        "POST /api/v1/facilitator/roster",
        "DELETE /api/v1/facilitator/roster/{username}",
    }
)

FREEPLAY_API_ROUTES = IDENTITY_ROUTES | {
    "GET /api/v1/achievements",
    "GET /api/v1/auth/me",
    "GET /api/v1/push-subscriptions/vapid-public-key",
    "POST /api/v1/push-subscriptions:subscribe",
    "POST /api/v1/push-subscriptions:unsubscribe",
    "POST /api/v1/push-subscriptions:test",
    "GET /api/v1/charts/power-sources/{resolution}",
    "GET /api/v1/charts/power-sinks/{resolution}",
    "GET /api/v1/charts/storage-level/{resolution}",
    "GET /api/v1/charts/storage-soc/{resolution}",
    "GET /api/v1/charts/revenues/{resolution}",
    "GET /api/v1/charts/op-costs/{resolution}",
    "GET /api/v1/charts/emissions/{resolution}",
    "GET /api/v1/charts/climate/{resolution}",
    "GET /api/v1/charts/temperature/{resolution}",
    "GET /api/v1/charts/money/{resolution}",
    "GET /api/v1/charts/resources/{resolution}",
    "GET /api/v1/charts/resources-soc/{resolution}",
    "GET /api/v1/charts/markets/{market_id}/clearing/{resolution}",
    "GET /api/v1/charts/markets/{market_id}/exports/{resolution}",
    "GET /api/v1/charts/markets/{market_id}/imports/{resolution}",
    "GET /api/v1/charts/markets/{market_id}/generation/{resolution}",
    "GET /api/v1/charts/markets/{market_id}/consumption/{resolution}",
    "GET /api/v1/charts/markets/{market_id}/market/{tick}",
    "GET /api/v1/chats",
    "POST /api/v1/chats",
    "GET /api/v1/chats/{chat_id}/messages",
    "POST /api/v1/chats/{chat_id}/messages",
    "POST /api/v1/chats/{chat_id}:open",
    "POST /api/v1/chats/{chat_id}:mute",
    "POST /api/v1/chats/{chat_id}:unmute",
    "GET /api/v1/daily-quiz",
    "POST /api/v1/daily-quiz",
    "GET /api/v1/electricity-markets",
    "POST /api/v1/electricity-markets",
    "POST /api/v1/electricity-markets/{network_id}:join",
    "POST /api/v1/electricity-markets/{network_id}:leave",
    "PATCH /api/v1/electricity-markets/prices",
    "GET /api/v1/facilities",
    "POST /api/v1/facilities/{facility_id}:upgrade",
    "POST /api/v1/facilities:upgrade-all",
    "POST /api/v1/facilities/{facility_id}:dismantle",
    "POST /api/v1/facilities:dismantle-all",
    "GET /api/v1/facilities/statuses",
    "GET /api/v1/game/engine",
    "GET /api/v1/lobby/my-runs",
    "GET /api/v1/map",
    "POST /api/v1/map/settle",
    "GET /api/v1/notifications",
    "GET /api/v1/notifications/feed-subscriptions",
    "PATCH /api/v1/notifications/feed-subscriptions",
    "PATCH /api/v1/notifications/{notification_id}",
    "DELETE /api/v1/notifications/{notification_id}",
    "POST /api/v1/notifications:markAllRead",
    "GET /api/v1/players",
    "GET /api/v1/players/game-state",
    "GET /api/v1/players/me",
    "GET /api/v1/players/me/settings",
    "PATCH /api/v1/players/me/settings",
    "GET /api/v1/players/me/money",
    "GET /api/v1/players/me/workers",
    "GET /api/v1/players/me/resources",
    "GET /api/v1/players/me/profile",
    "GET /api/v1/power-priorities",
    "PUT /api/v1/power-priorities",
    "POST /api/v1/power-priorities/{side}/{item_type}:increase-priority",
    "POST /api/v1/power-priorities/{side}/{item_type}:decrease-priority",
    "GET /api/v1/projects",
    "POST /api/v1/projects",
    "POST /api/v1/projects/{project_id}:cancel",
    "POST /api/v1/projects/{project_id}:pause",
    "POST /api/v1/projects/{project_id}:resume",
    "POST /api/v1/projects/{project_id}:decrease-priority",
    "POST /api/v1/projects/{project_id}:increase-priority",
    "GET /api/v1/projects/catalog/power-facilities",
    "GET /api/v1/projects/catalog/storage-facilities",
    "GET /api/v1/projects/catalog/extraction-facilities",
    "GET /api/v1/projects/catalog/functional-facilities",
    "GET /api/v1/projects/catalog/technologies",
    "GET /api/v1/resource-market/asks",
    "POST /api/v1/resource-market/asks",
    "POST /api/v1/resource-market/asks/{ask_id}:purchase",
    "PATCH /api/v1/resource-market/asks/{ask_id}",
    "DELETE /api/v1/resource-market/asks/{ask_id}",
    "POST /api/v1/resource-market/asks/{ask_id}:calculate-delivery",
    "GET /api/v1/run",
    "GET /api/v1/shipments",
    "GET /api/v1/leaderboards",
    "GET /api/v1/weather",
    "GET /api/v1/weather/climate-event-recoveries",
}

WORKSHOP_API_ROUTES = IDENTITY_ROUTES | {
    "GET /api/v1/run",
    "POST /api/v1/workshop/enter",
    "GET /api/v1/workshop/session",
    "POST /api/v1/workshop/session/advance",
    "POST /api/v1/workshop/session/phase/extend",
    "GET /api/v1/workshop/timers",
    "PUT /api/v1/workshop/timers",
    "GET /api/v1/workshop/unlocks",
    "GET /api/v1/workshop/events",
    "GET /api/v1/workshop/plans",
    "PATCH /api/v1/workshop/plans/{round_number}/levers",
    "PUT /api/v1/workshop/plans/{round_number}/events",
    "DELETE /api/v1/workshop/plans/{round_number}/events/{event_id}",
    "GET /api/v1/workshop/facilities",
    "GET /api/v1/workshop/fleet",
    "GET /api/v1/workshop/selection",
    "POST /api/v1/workshop/selection",
    "DELETE /api/v1/workshop/selection/{facility}",
    "GET /api/v1/workshop/prices",
    "PUT /api/v1/workshop/prices/{facility}/{side}",
    "GET /api/v1/workshop/prices/locked",
    "GET /api/v1/workshop/fuel",
    "PUT /api/v1/workshop/fuel/{fuel}",
    "GET /api/v1/workshop/periods/{round_number}/{season}",
    "GET /api/v1/workshop/periods/{round_number}/{season}/days/{day}",
    "GET /api/v1/workshop/periods/{round_number}/{season}/points/{point}/merit-order",
    "GET /api/v1/workshop/rounds/{round_number}/balance-sheet",
}

LOBBY_API_ROUTES = frozenset(
    {
        "POST /api/v1/auth/login",
        "POST /api/v1/auth/signup",
        "POST /api/v1/auth/change-password-form",
        "POST /api/v1/auth/logout",
        "GET /api/v1/lobby/my-runs",
        "POST /api/v1/lobby/runs/{slug}/join",
    }
)

API_ROUTES = {"freeplay": FREEPLAY_API_ROUTES, "workshop": WORKSHOP_API_ROUTES, "lobby": LOBBY_API_ROUTES}

# API routes an app serves but leaves out of its schema on purpose. The change-password form posts
# from a plain HTML form, not from the frontend's API client, so it has no generated type.
NOT_IN_SCHEMA = {
    "freeplay": frozenset(),
    "workshop": frozenset(),
    "lobby": frozenset({"POST /api/v1/auth/change-password-form"}),
}

HTTP_METHODS = frozenset({"get", "put", "post", "delete", "options", "head", "patch", "trace"})


@pytest.fixture(scope="module")
def apps(tmp_path_factory: pytest.TempPathFactory) -> dict[str, FastAPI]:
    """The real app of each kind. Module-scoped because building the apps is the slow part."""
    workshop_config = InstanceConfig.model_validate(
        {"name": "Workshop", "advertised": False, "starts_at": "2026-03-01T00:00:00Z", "run": {"mode": "workshop"}}
    )
    session_path = tmp_path_factory.mktemp("workshop") / "workshop_session.json"
    return {
        "freeplay": create_app(rm_instance=True, skip_adding_handlers=True, env="dev"),
        "workshop": create_workshop_app(workshop_config, session_path=session_path),
        "lobby": create_lobby_app(),
    }


@pytest.fixture(scope="module")
def generator() -> ModuleType:
    """The script `bun run generate-types` runs to write each app's OpenAPI schema."""
    spec = importlib.util.spec_from_file_location("generate_openapi_schema", _GENERATOR)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _paths(app: FastAPI) -> set[str]:
    return {path for route in app.routes if (path := getattr(route, "path", None))}


def _api_routes(app: FastAPI) -> set[str]:
    """Every ``METHOD /api/...`` route ``app`` serves."""
    return {
        f"{method} {route.path}"
        for route in app.routes
        if isinstance(route, APIRoute) and route.path.startswith("/api/")
        for method in route.methods
    }


@pytest.mark.parametrize("app_name", APPS)
def test_no_routes_outside_api_socketio_and_healthz(apps: dict[str, FastAPI], app_name: str) -> None:
    """A route outside the documented surface is either dead or belongs behind /api/v1."""
    non_api = {path for path in _paths(apps[app_name]) if not path.startswith("/api/")}

    assert non_api == FASTAPI_BUILTIN_PATHS | NON_API_PATHS[app_name]


@pytest.mark.parametrize("app_name", APPS)
def test_api_routes_are_pinned(apps: dict[str, FastAPI], app_name: str) -> None:
    """Adding or removing an API route is a deliberate change: it means updating the list above."""
    assert _api_routes(apps[app_name]) == API_ROUTES[app_name]


@pytest.mark.parametrize("app_name", ["freeplay", "workshop"])
def test_both_instance_apps_serve_the_identity_routes(apps: dict[str, FastAPI], app_name: str) -> None:
    """A Run in either mode admits players through the join link and the facilitator's roster."""
    assert IDENTITY_ROUTES <= _api_routes(apps[app_name])


@pytest.mark.parametrize("app_name", APPS)
def test_app_schema_lists_exactly_the_routes_the_app_serves(
    apps: dict[str, FastAPI], generator: ModuleType, app_name: str
) -> None:
    """Each app's generated schema, and so its types file, covers its own routes and no others."""
    spec = generator.app_spec(app_name)
    schema_routes = {
        f"{method.upper()} {path}" for path, item in spec["paths"].items() for method in item if method in HTTP_METHODS
    }

    assert schema_routes == _api_routes(apps[app_name]) - NOT_IN_SCHEMA[app_name]
