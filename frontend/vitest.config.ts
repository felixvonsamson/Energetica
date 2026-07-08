import { defineConfig } from "vitest/config";
import path from "path";

// Unit tests target pure resolver cores (backend/lobby URL derivation), which
// take their environment as arguments — so no DOM or import.meta stubbing is
// needed and the default `node` environment suffices.
export default defineConfig({
    resolve: {
        alias: { "@": path.resolve(__dirname, "./src") },
    },
    test: {
        include: ["src/**/*.test.ts", "*.test.ts"],
    },
});
