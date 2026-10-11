#!/usr/bin/env python3
"""Generate the OpenAPI schemas from the FastAPI apps without running a server.

Writes one schema per app (``openapi-schema.<app>.json``) and one merged schema
(``openapi-schema.json``), all next to this script. ``scripts/generate-types.sh`` turns each into a
types file.
"""

import copy
import json
import sys
from collections.abc import Callable
from pathlib import Path

from fastapi import FastAPI

from energetica.freeplay.app import create_app
from energetica.kernel.game_error import GameExceptionType
from energetica.workshop.app import create_workshop_app
from lobby import create_lobby_app

SCRIPT_DIR = Path(__file__).parent

# Each app's schema-only builder, keyed by the name used in its file names. The order is the order
# the merge reads them in, so freeplay's version of a same-named component schema wins.
APPS: dict[str, Callable[[], FastAPI]] = {
    "freeplay": lambda: create_app(env="dev", schema_only=True),
    "lobby": lambda: create_lobby_app(schema_only=True),
    "workshop": lambda: create_workshop_app(schema_only=True),
}


def app_spec(name: str) -> dict:
    """Return the OpenAPI schema of the app called ``name``."""
    spec = APPS[name]().openapi()
    if not spec:
        raise RuntimeError(f"Failed to generate the {name} OpenAPI spec")
    return spec


def add_game_exception_type(spec: dict) -> None:
    """Add ``GameExceptionType`` to ``spec``'s component schemas.

    The global GameError exception handler never appears in route response models, so it won't be
    picked up automatically — we add it explicitly so the frontend can use the generated type to
    constrain error-handling call sites. Every schema gets every code for now; #1174 splits them.
    """
    spec.setdefault("components", {}).setdefault("schemas", {})
    spec["components"]["schemas"]["GameExceptionType"] = {
        "type": "string",
        "enum": [e.value for e in GameExceptionType],
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


def generate_schemas() -> None:
    """Generate each app's schema and the merged schema, and write them to files.

    Each app's schema describes only the routes that app serves. The merged schema is the union of
    all three, and backs the single ``api.generated.ts`` that every frontend bundle uses today: the
    game instance, the lobby and the landing. Later work (#1171) moves each frontend app onto its
    own types file and deletes the merged one.
    """
    specs = {name: app_spec(name) for name in APPS}

    first, *rest = specs.values()
    merged = copy.deepcopy(first)
    for spec in rest:
        merge_spec(merged, spec)

    for name, spec in specs.items():
        add_game_exception_type(spec)
        write_spec(spec, f"openapi-schema.{name}.json")
    add_game_exception_type(merged)
    write_spec(merged, "openapi-schema.json")


if __name__ == "__main__":
    try:
        generate_schemas()
    except Exception as e:
        print(f"❌ Error generating OpenAPI schema: {e}", file=sys.stderr)
        sys.exit(1)
