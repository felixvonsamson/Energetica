import { defineConfig } from "vitest/config";

// The frontend directory's own tests (the lint boundaries and the shared Vite
// helpers), and the tests of every shared package, which has no Vitest config of
// its own and so runs with this one. Each app has its own config. The tests take
// their environment as arguments, so the default `node` environment suffices.
export default defineConfig({
    test: {
        include: ["src/**/*.test.ts", "*.test.ts"],
    },
});
