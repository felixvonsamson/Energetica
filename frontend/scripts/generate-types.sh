#!/bin/bash
# Generate TypeScript types from OpenAPI schema
# Usage: npm run generate-types

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:5001}"
SCHEMA_FILE="scripts/openapi-schema.json"
OUTPUT_FILE="src/types/api.generated.ts"

echo "🔧 Generating API types..."

# Try to fetch from live backend first
if curl -sf "${BACKEND_URL}/openapi.json" -o "$SCHEMA_FILE" 2>/dev/null; then
    echo "✓ Fetched schema from ${BACKEND_URL}/openapi.json"
    npx openapi-typescript "$SCHEMA_FILE" -o "$OUTPUT_FILE"
    echo "✓ Types generated at $OUTPUT_FILE"
elif [ -f "$SCHEMA_FILE" ]; then
    echo "⚠️  Backend not running, using cached schema from $SCHEMA_FILE"
    npx openapi-typescript "$SCHEMA_FILE" -o "$OUTPUT_FILE"
    echo "✓ Types generated from cached schema"
else
    echo "❌ Error: Backend is not running and no cached schema found"
    echo "   Please start the backend at ${BACKEND_URL} or save the OpenAPI schema to $SCHEMA_FILE"
    exit 1
fi

echo "🎨 Formatting generated types..."
npx prettier --write "$OUTPUT_FILE"

echo "✨ Done!"
