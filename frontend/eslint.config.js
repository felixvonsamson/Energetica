// @ts-nocheck
import fs from "node:fs";

import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import pluginQuery from "@tanstack/eslint-plugin-query";

// The combined app, the lobby and the landing page are separate bundles that still
// share one src directory. Each bundle's own entry files may not import another
// bundle's. Code they share lives in the rest of src or in packages/.
const BUNDLE_FILES = {
    app: ["./src/main.tsx", "./src/routes", "./src/routeTree.gen.ts"],
    lobby: [
        "./src/main-lobby.tsx",
        "./src/routes-lobby",
        "./src/routeTree.lobby.gen.ts",
        "./src/components/lobby",
    ],
    landing: [
        "./src/main-landing.tsx",
        "./src/routes-landing",
        "./src/routeTree.landing.gen.ts",
    ],
};
const BUNDLE_ZONES = [
    ...Object.entries(BUNDLE_FILES).map(([bundle, target]) => ({
        target,
        from: Object.entries(BUNDLE_FILES)
            .filter(([other]) => other !== bundle)
            .flatMap(([, files]) => files),
        message: `This file belongs to the ${bundle} bundle and cannot import another bundle's files.`,
    })),
    {
        target: "./packages",
        from: "./src",
        message: "Shared packages cannot import from an app.",
    },
];

export default defineConfig([
    {
        ignores: [
            "node_modules/",
            "dist/",
            "dist-app/",
            "dist-landing/",
            "dist-lobby/",
            "*.config.ts",
            "*.config.js",
            "src/service-worker.ts",
        ],
    },
    { settings: { react: { version: "detect" } } },
    ...tseslint.configs.recommended,
    react.configs.flat.recommended,
    {
        files: ["src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                ecmaFeatures: {
                    jsx: true,
                },
                project: [
                    "./tsconfig.json",
                    "./tsconfig.landing.json",
                    "./tsconfig.lobby.json",
                    "./packages/ui/tsconfig.json",
                    "./packages/core/tsconfig.json",
                ],
            },
            globals: {
                // Browser globals
                console: "readonly",
                setTimeout: "readonly",
                setInterval: "readonly",
                clearTimeout: "readonly",
                clearInterval: "readonly",
                setImmediate: "readonly",
                clearImmediate: "readonly",
                window: "readonly",
                document: "readonly",
                navigator: "readonly",
                React: "readonly",
            },
        },
        plugins: {
            import: importPlugin,
        },
        settings: {
            "import/resolver": {
                typescript: {
                    alwaysTryTypes: true,
                    project: [
                    "./tsconfig.json",
                    "./tsconfig.landing.json",
                    "./tsconfig.lobby.json",
                    "./packages/ui/tsconfig.json",
                    "./packages/core/tsconfig.json",
                ],
                },
                node: true,
            },
            "import/internal-regex": "^@/",
        },
        rules: {
            "import/order": [
                "error",
                {
                    groups: [
                        "builtin",
                        "external",
                        "internal",
                        "parent",
                        "sibling",
                        "index",
                    ],
                    alphabetize: {
                        order: "asc",
                        caseInsensitive: true,
                    },
                    "newlines-between": "always",
                },
            ],
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: ["../*"],
                            message:
                                "Relative parent imports are not allowed. Use absolute imports with @/ instead.",
                        },
                    ],
                },
            ],
            // React extras (recommended rules come from react.configs.flat.recommended above)
            "react/no-unescaped-entities": "off",
            "react/jsx-no-useless-fragment": ["error", { allowExpressions: true }],
            "react/no-array-index-key": "warn",
            "react/no-unstable-nested-components": "warn",
            "react/self-closing-comp": "warn",
            // TypeScript unused variables and imports
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/no-unnecessary-condition": "warn",
            "import/no-duplicates": "error",
            // A workspace package may only import what its own package.json declares.
            // Under the isolated install layout, a dependency nobody declares does not
            // resolve at all, which no-unresolved reports. Two cases still resolve and
            // need no-extraneous-dependencies: a dependency the root package declares,
            // since Node looks up the directory tree into frontend/node_modules, and
            // `react` and `react-dom`, which the Vite React plugin resolves from the app
            // whoever imports them. Type-only imports are checked too.
            "import/no-unresolved": ["error", { ignore: ["\\?react$"] }],
            "import/no-extraneous-dependencies": [
                "error",
                { includeTypes: true, devDependencies: ["**/*.test.ts"] },
            ],
            // Import another workspace package by its name, never through a relative
            // path into its directory.
            "import/no-relative-packages": "error",
            "import/no-restricted-paths": ["error", { zones: BUNDLE_ZONES }],
        },
    },
    // Shared packages resolve their own files with relative imports. `@/` means
    // "this app's src", so inside a package it would silently point at whichever
    // app is compiling it. A package importing itself by name only resolves
    // through the root package's node_modules, which the apps will not share.
    ...fs.readdirSync(new URL("./packages", import.meta.url)).map((name) => ({
        files: [`packages/${name}/src/**/*.{ts,tsx}`],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: ["@/*"],
                            message:
                                "Shared packages cannot use the app-local @/ alias. Use a relative import inside the package, or import another package by name.",
                        },
                        {
                            group: [`@energetica/${name}`, `@energetica/${name}/*`],
                            message:
                                "Use a relative import for a file in the same package.",
                        },
                    ],
                },
            ],
        },
    })),
    reactHooks.configs.flat["recommended-latest"],
    jsxA11y.flatConfigs.recommended,
    ...pluginQuery.configs["flat/recommended"],
]);
