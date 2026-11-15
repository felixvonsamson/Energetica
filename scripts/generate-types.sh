#!/bin/bash
# Generate TypeScript types from the OpenAPI schemas: one types file per app
# (freeplay, workshop, lobby), inside that app's workspace package.
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
    # Import the backend from this checkout. A git worktree can share another
    # checkout's .venv, whose editable install points at that checkout's backend/src/.
    export PYTHONPATH="$PROJECT_ROOT/backend/src${PYTHONPATH:+:$PYTHONPATH}"
    python scripts/generate_openapi_schema.py
) || {
    echo "❌ Failed to generate OpenAPI schema"
    exit 1
}

# Generate TypeScript types: one file per app.
for app in freeplay workshop lobby; do
    bunx openapi-typescript "$SCRIPT_DIR/openapi-schema.$app.json" -o "$PROJECT_ROOT/frontend/apps/$app/$TYPES_DIR/api.generated.ts"
done
echo "✓ Types generated in frontend/apps/{freeplay,workshop,lobby}/$TYPES_DIR"
# No Prettier pass: .prettierignore lists the generated files, so they stay as openapi-typescript
# writes them (#1325).

echo "✨ Done!"
