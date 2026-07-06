#!/usr/bin/env python3
"""Generate OpenAPI schema from FastAPI app without running the server."""

import json
import sys
from pathlib import Path

# Add the project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from energetica import create_app
from energetica.game_error import GameExceptionType
from lobby import create_lobby_app


def generate_schema() -> None:
    """Generate OpenAPI schema and write to file.

    The frontend's generated types are one shared file (``api.generated.ts``) consumed by every
    bundle — the game instance, the lobby, and the landing. So the schema must union the routes of
    both backends. Since the lobby cutover (#817) the credential endpoints (login / signup / logout
    / change-password) live only on the **lobby** app; the instance keeps ``/auth/me`` and the game
    API. We merge the lobby app's paths and schemas into the instance spec so the lobby bundle's
    calls stay type-checked. Overlapping paths (e.g. ``/api/v1/lobby/my-runs``, served identically
    by both) and identically-named component schemas coincide, so a shallow union is well-defined.
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
    paths = openapi_spec.setdefault("paths", {})
    for path, item in lobby_spec.get("paths", {}).items():
        # Union the HTTP methods declared for each path; the instance and lobby never define the
        # same (path, method) with a different shape, so last-writer-wins on a collision is safe.
        paths.setdefault(path, {}).update(item)
    schemas = openapi_spec.setdefault("components", {}).setdefault("schemas", {})
    for name, schema in lobby_spec.get("components", {}).get("schemas", {}).items():
        # Both apps derive schemas from energetica.schemas.*, so same-named schemas are identical;
        # keep the instance's to avoid needless churn if a title/order ever differs.
        schemas.setdefault(name, schema)

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
