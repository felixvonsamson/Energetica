#!/bin/bash
# Generate TypeScript types from OpenAPI schema
# Usage: npm run generate-types

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SCHEMA_FILE="$SCRIPT_DIR/openapi-schema.json"
OUTPUT_FILE="$PROJECT_ROOT/frontend/src/types/api.generated.ts"

echo "🔧 Generating API types..."

# Generate OpenAPI schema from FastAPI app
echo "📋 Generating OpenAPI schema from backend..."
(cd "$PROJECT_ROOT" && source .venv/bin/activate && python scripts/generate_openapi_schema.py) || {
    echo "❌ Failed to generate OpenAPI schema"
    exit 1
}

# Generate TypeScript types
npx openapi-typescript "$SCHEMA_FILE" -o "$OUTPUT_FILE"
echo "✓ Types generated at $OUTPUT_FILE"

# Format
echo "🎨 Formatting generated types..."
npx prettier --write "$OUTPUT_FILE"

echo "✨ Done!"
