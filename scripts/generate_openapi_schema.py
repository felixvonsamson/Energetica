#!/usr/bin/env python3
"""Generate OpenAPI schema from FastAPI app without running the server."""

import json
import sys
from pathlib import Path

# Add the project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from energetica import create_app


def generate_schema() -> None:
    """Generate OpenAPI schema and write to file."""
    # Create app without running it (env="dev" to avoid unnecessary initialization)
    app = create_app(env="dev")

    # Get the OpenAPI spec
    openapi_spec = app.openapi()

    if not openapi_spec:
        raise RuntimeError("Failed to generate OpenAPI spec")

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
