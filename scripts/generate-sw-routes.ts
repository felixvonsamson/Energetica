#!/usr/bin/env bun
// Extracts the AppRoute type (fullPaths union) from routeTree.gen.ts into a
// standalone file with no imports, safe to include in the service-worker tsconfig.

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const routeTreePath = resolve(root, "frontend/src/routeTree.gen.ts");
const outputPath = resolve(root, "frontend/src/types/app-routes.ts");

const src = readFileSync(routeTreePath, "utf-8");

// Extract the fullPaths block from FileRouteTypes
const match = src.match(/fullPaths:\n((?:\s*\| '[^']+'\n)+)/);
if (!match) {
    console.error("Could not find fullPaths in routeTree.gen.ts");
    process.exit(1);
}

const paths = match[1].trimEnd();
const output = `\
// Auto-generated from routeTree.gen.ts — do not edit manually.
// Run \`bun run build:sw\` to update.
export type AppRoute =
${paths};
`;

writeFileSync(outputPath, output);
console.log("Generated frontend/src/types/app-routes.ts");
