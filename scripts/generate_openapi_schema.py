#!/usr/bin/env python3
"""Generate the OpenAPI schemas from the FastAPI apps without running a server.

Writes one schema per app (``openapi-schema.<app>.json``) next to this script.
``scripts/generate-types.sh`` turns each app's schema into that app's types file.
"""

import json
import sys
from collections.abc import Callable, Iterable
from pathlib import Path

from fastapi import FastAPI

from energetica.freeplay.app import create_app
from energetica.freeplay.game_error import FreeplayErrorCode
from energetica.identity.game_error import IdentityErrorCode
from energetica.kernel.game_error import ErrorCode, SharedErrorCode
from energetica.lobby import create_lobby_app
from energetica.lobby.game_error import LobbyErrorCode
from energetica.workshop.app import create_workshop_app
from energetica.workshop.game_error import WorkshopErrorCode

SCRIPT_DIR = Path(__file__).parent

# Each app's schema-only builder, keyed by the name used in its file names.
APPS: dict[str, Callable[[], FastAPI]] = {
    "freeplay": lambda: create_app(env="dev", schema_only=True),
    "lobby": lambda: create_lobby_app(schema_only=True),
    "workshop": lambda: create_workshop_app(schema_only=True),
}

# The error codes each app can return: the kernel's shared codes, the identity layer's when the app
# mounts the join and facilitator routes, and the app's own.
APP_ERROR_CODES: dict[str, tuple[type[ErrorCode], ...]] = {
    "freeplay": (SharedErrorCode, IdentityErrorCode, FreeplayErrorCode),
    "lobby": (SharedErrorCode, LobbyErrorCode),
    "workshop": (SharedErrorCode, IdentityErrorCode, WorkshopErrorCode),
}


def app_spec(name: str) -> dict:
    """Return the OpenAPI schema of the app called ``name``."""
    spec = APPS[name]().openapi()
    if not spec:
        raise RuntimeError(f"Failed to generate the {name} OpenAPI spec")
    return spec


def add_error_codes(spec: dict, error_codes: Iterable[type[ErrorCode]]) -> None:
    """Add ``ErrorCode``, holding every code of the enums in ``error_codes``, to ``spec``'s
    component schemas.

    The global GameError exception handler never appears in route response models, so it won't be
    picked up automatically — we add it explicitly so the frontend can use the generated type to
    constrain error-handling call sites. The schema is called ``ErrorCode`` whichever enums
    the codes come from, so every frontend refers to the same name.
    """
    spec.setdefault("components", {}).setdefault("schemas", {})
    spec["components"]["schemas"]["ErrorCode"] = {
        "type": "string",
        "enum": list(dict.fromkeys(code.value for enum in error_codes for code in enum)),
        "title": "ErrorCode",
    }


def write_spec(spec: dict, filename: str) -> None:
    """Write ``spec`` as JSON to ``filename`` next to this script."""
    output_path = SCRIPT_DIR / filename
    with open(output_path, "w") as f:
        json.dump(spec, f, indent=2)
    print(f"✓ OpenAPI schema generated at {output_path}")


def build_schemas() -> dict[str, dict]:
    """Build each app's schema, keyed by app name.

    Each app's schema describes only the routes that app serves and the error codes it can return.
    """
    specs = {name: app_spec(name) for name in APPS}
    for name, spec in specs.items():
        add_error_codes(spec, APP_ERROR_CODES[name])
    return specs


def generate_schemas() -> None:
    """Write each app's schema to ``openapi-schema.<app>.json``."""
    for name, spec in build_schemas().items():
        write_spec(spec, f"openapi-schema.{name}.json")


if __name__ == "__main__":
    try:
        generate_schemas()
    except Exception as e:
        print(f"❌ Error generating OpenAPI schema: {e}", file=sys.stderr)
        sys.exit(1)
