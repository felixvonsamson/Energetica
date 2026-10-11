#!/bin/bash
# Generate TypeScript types from the OpenAPI schemas: one types file per app
# (freeplay, workshop, lobby) and the merged file every bundle uses today.
# Usage: npm run generate-types

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TYPES_DIR="src/types"

echo "🔧 Generating API types..."

# Generate the OpenAPI schemas from the FastAPI apps.
# Activate the local .venv when present; in CI there is no .venv and deps are
# installed against the `python` already on PATH, so fall back to that.
echo "📋 Generating OpenAPI schemas from backend..."
(
    cd "$PROJECT_ROOT"
    [ -f .venv/bin/activate ] && source .venv/bin/activate
    python scripts/generate_openapi_schema.py
) || {
    echo "❌ Failed to generate OpenAPI schema"
    exit 1
}

# Generate TypeScript types: the merged schema, then each app's.
OUTPUTS=("$TYPES_DIR/api.generated.ts")
bunx openapi-typescript "$SCRIPT_DIR/openapi-schema.json" -o "$PROJECT_ROOT/frontend/${OUTPUTS[0]}"
for app in freeplay workshop lobby; do
    output="$TYPES_DIR/api.$app.generated.ts"
    bunx openapi-typescript "$SCRIPT_DIR/openapi-schema.$app.json" -o "$PROJECT_ROOT/frontend/$output"
    OUTPUTS+=("$output")
done
echo "✓ Types generated in frontend/$TYPES_DIR"

# Format
echo "🎨 Formatting generated types..."
(cd "$PROJECT_ROOT/frontend" && bunx prettier --write "${OUTPUTS[@]}")

echo "✨ Done!"
