#!/usr/bin/env python3
"""Generate the OpenAPI schemas from the FastAPI apps without running a server.

Writes one schema per app (``openapi-schema.<app>.json``) and one merged schema
(``openapi-schema.json``), all next to this script. ``scripts/generate-types.sh`` turns each into a
types file.
"""

import copy
import json
import sys
from collections.abc import Callable, Iterable
from pathlib import Path

from fastapi import FastAPI

from energetica.freeplay.app import create_app
from energetica.freeplay.game_error import FreeplayExceptionType
from energetica.identity.game_error import IdentityExceptionType
from energetica.kernel.game_error import ErrorCode, GameExceptionType
from energetica.workshop.app import create_workshop_app
from energetica.workshop.game_error import WorkshopExceptionType
from lobby import create_lobby_app
from lobby.game_error import LobbyExceptionType

SCRIPT_DIR = Path(__file__).parent

# Each app's schema-only builder, keyed by the name used in its file names. The order is the order
# the merge reads them in, so freeplay's version of a same-named component schema wins.
APPS: dict[str, Callable[[], FastAPI]] = {
    "freeplay": lambda: create_app(env="dev", schema_only=True),
    "lobby": lambda: create_lobby_app(schema_only=True),
    "workshop": lambda: create_workshop_app(schema_only=True),
}

# The error codes each app can return: the kernel's shared codes, the identity layer's when the app
# mounts the join and facilitator routes, and the app's own.
APP_ERROR_CODES: dict[str, tuple[type[ErrorCode], ...]] = {
    "freeplay": (GameExceptionType, IdentityExceptionType, FreeplayExceptionType),
    "lobby": (GameExceptionType, LobbyExceptionType),
    "workshop": (GameExceptionType, IdentityExceptionType, WorkshopExceptionType),
}


def app_spec(name: str) -> dict:
    """Return the OpenAPI schema of the app called ``name``."""
    spec = APPS[name]().openapi()
    if not spec:
        raise RuntimeError(f"Failed to generate the {name} OpenAPI spec")
    return spec


def add_game_exception_type(spec: dict, error_codes: Iterable[type[ErrorCode]]) -> None:
    """Add ``GameExceptionType``, holding every code of the enums in ``error_codes``, to ``spec``'s
    component schemas.

    The global GameError exception handler never appears in route response models, so it won't be
    picked up automatically — we add it explicitly so the frontend can use the generated type to
    constrain error-handling call sites. The schema is called ``GameExceptionType`` whichever enums
    the codes come from, so every frontend refers to the same name.
    """
    spec.setdefault("components", {}).setdefault("schemas", {})
    spec["components"]["schemas"]["GameExceptionType"] = {
        "type": "string",
        "enum": list(dict.fromkeys(code.value for enum in error_codes for code in enum)),
        "title": "GameExceptionType",
    }


def merge_spec(openapi_spec: dict, other_spec: dict) -> None:
    """Add ``other_spec``'s paths and component schemas to ``openapi_spec``.

    The backends never define the same (path, method) with a different shape, so last-writer-wins
    on a collision is safe. Same-named component schemas are kept from the first spec. They are
    usually the same Python model, but not always: freeplay's and Workshop's ``Fuel`` differ, and
    the merged file keeps freeplay's. The per-app files each keep their own.
    """
    paths = openapi_spec.setdefault("paths", {})
    for path, item in other_spec.get("paths", {}).items():
        paths.setdefault(path, {}).update(item)
    schemas = openapi_spec.setdefault("components", {}).setdefault("schemas", {})
    for name, schema in other_spec.get("components", {}).get("schemas", {}).items():
        schemas.setdefault(name, schema)


def write_spec(spec: dict, filename: str) -> None:
    """Write ``spec`` as JSON to ``filename`` next to this script."""
    output_path = SCRIPT_DIR / filename
    with open(output_path, "w") as f:
        json.dump(spec, f, indent=2)
    print(f"✓ OpenAPI schema generated at {output_path}")


def build_schemas() -> dict[str, dict]:
    """Build each app's schema and the merged schema, keyed by app name and ``"merged"``.

    Each app's schema describes only the routes that app serves and the error codes it can return.
    The merged schema is the union of all three, and backs the single ``api.generated.ts`` that
    every frontend bundle uses today: the game instance, the lobby and the landing. Later work
    (#1171) moves each frontend app onto its own types file and deletes the merged one.
    """
    specs = {name: app_spec(name) for name in APPS}

    first, *rest = specs.values()
    merged = copy.deepcopy(first)
    for spec in rest:
        merge_spec(merged, spec)

    for name, spec in specs.items():
        add_game_exception_type(spec, APP_ERROR_CODES[name])
    add_game_exception_type(merged, (enum for enums in APP_ERROR_CODES.values() for enum in enums))
    return {**specs, "merged": merged}


def generate_schemas() -> None:
    """Write each app's schema to ``openapi-schema.<app>.json`` and the merged one to
    ``openapi-schema.json``.
    """
    schemas = build_schemas()
    merged = schemas.pop("merged")
    for name, spec in schemas.items():
        write_spec(spec, f"openapi-schema.{name}.json")
    write_spec(merged, "openapi-schema.json")


if __name__ == "__main__":
    try:
        generate_schemas()
    except Exception as e:
        print(f"❌ Error generating OpenAPI schema: {e}", file=sys.stderr)
        sys.exit(1)
