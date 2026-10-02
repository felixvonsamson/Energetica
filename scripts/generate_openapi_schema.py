#!/usr/bin/env python3
"""Generate OpenAPI schema from FastAPI app without running the server."""

import json
import sys
from pathlib import Path

from energetica.freeplay.app import create_app
from energetica.kernel.game_error import GameExceptionType
from energetica.workshop.app import create_workshop_app
from lobby import create_lobby_app


def merge_spec(openapi_spec: dict, other_spec: dict) -> None:
    """Add ``other_spec``'s paths and component schemas to ``openapi_spec``.

    The backends never define the same (path, method) with a different shape, so last-writer-wins
    on a collision is safe. Same-named component schemas come from the same Python models, so the
    first one is kept to avoid needless churn if a title or field order ever differs.
    """
    paths = openapi_spec.setdefault("paths", {})
    for path, item in other_spec.get("paths", {}).items():
        paths.setdefault(path, {}).update(item)
    schemas = openapi_spec.setdefault("components", {}).setdefault("schemas", {})
    for name, schema in other_spec.get("components", {}).get("schemas", {}).items():
        schemas.setdefault(name, schema)


def generate_schema() -> None:
    """Generate OpenAPI schema and write to file.

    The frontend's generated types are one shared file (``api.generated.ts``) consumed by every
    bundle — the game instance, the lobby, and the landing. So the schema must union the routes of
    every backend. Since the lobby cutover (#817) the credential endpoints (login / signup / logout
    / change-password) live only on the **lobby** app; the instance keeps ``/auth/me`` and the game
    API. A Workshop Run's instance serves Workshop's app instead of the persistent world's (#994);
    its routes are under ``/api/v1/workshop``, apart from ``/api/v1/run``, which both instance apps
    serve identically. Overlapping paths (e.g. ``/api/v1/lobby/my-runs``, served identically by the
    instance and the lobby) and identically-named component schemas coincide, so a shallow union is
    well-defined.
    """
    # Create minimal apps for schema generation only
    app = create_app(env="dev", schema_only=True)

    # Get the OpenAPI spec
    openapi_spec = app.openapi()

    if not openapi_spec:
        raise RuntimeError("Failed to generate OpenAPI spec")

    lobby_spec = create_lobby_app(schema_only=True).openapi()
    if not lobby_spec:
        raise RuntimeError("Failed to generate lobby OpenAPI spec")
    merge_spec(openapi_spec, lobby_spec)

    workshop_spec = create_workshop_app(schema_only=True).openapi()
    if not workshop_spec:
        raise RuntimeError("Failed to generate Workshop OpenAPI spec")
    merge_spec(openapi_spec, workshop_spec)

    # Inject GameExceptionType as a schema component.
    # The global GameError exception handler never appears in route response models,
    # so it won't be picked up automatically — we add it explicitly so the frontend
    # can use the generated type to constrain error-handling call sites.
    openapi_spec.setdefault("components", {}).setdefault("schemas", {})
    openapi_spec["components"]["schemas"]["GameExceptionType"] = {
        "type": "string",
        "enum": [e.value for e in GameExceptionType],
        "title": "GameExceptionType",
    }

    # Write to file in scripts/
    output_path = Path(__file__).parent / "openapi-schema.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        json.dump(openapi_spec, f, indent=2)

    print(f"✓ OpenAPI schema generated at {output_path}")


if __name__ == "__main__":
    try:
        generate_schema()
    except Exception as e:
        print(f"❌ Error generating OpenAPI schema: {e}", file=sys.stderr)
        sys.exit(1)
