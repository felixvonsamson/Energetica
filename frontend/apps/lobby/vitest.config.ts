import { defineConfig } from "vitest/config";
import path from "path";

// Unit tests target pure helpers, which take their environment as arguments,
// so the default `node` environment suffices.
export default defineConfig({
    resolve: {
        alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
});
