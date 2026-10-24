// @ts-nocheck
import fs from "node:fs";

import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import pluginQuery from "@tanstack/eslint-plugin-query";

// The combined app and the lobby are separate bundles that still share one src
// directory. Each bundle's own entry files may not import another bundle's. Code
// they share lives in the rest of src or in packages/. The apps under apps/ are
// workspace packages of their own, so the package rules below cover them.
const BUNDLE_FILES = {
    app: ["./src/main.tsx", "./src/routes", "./src/routeTree.gen.ts"],
    lobby: [
        "./src/main-lobby.tsx",
        "./src/routes-lobby",
        "./src/routeTree.lobby.gen.ts",
        "./src/components/lobby",
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
        from: ["./src", "./apps"],
        message: "Shared packages cannot import from an app.",
    },
];

// The workspace packages in a folder. Only folders with a package.json count,
// so stray files such as macOS's .DS_Store are skipped.
const workspaces = (group) =>
    fs
        .readdirSync(new URL(`./${group}`, import.meta.url))
        .filter((name) =>
            fs.existsSync(new URL(`./${group}/${name}/package.json`, import.meta.url)),
        );
const APPS = workspaces("apps");
const PACKAGES = workspaces("packages");
const TSCONFIGS = [
    "./tsconfig.json",
    "./tsconfig.lobby.json",
    ...APPS.map((name) => `./apps/${name}/tsconfig.json`),
    ...PACKAGES.map((name) => `./packages/${name}/tsconfig.json`),
];

export default defineConfig([
    {
        ignores: [
            "node_modules/",
            "dist/",
            "dist-app/",
            "apps/*/dist/",
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
        files: [
            "src/**/*.{ts,tsx}",
            "apps/*/src/**/*.{ts,tsx}",
            "packages/*/src/**/*.{ts,tsx}",
        ],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                ecmaFeatures: {
                    jsx: true,
                },
                project: TSCONFIGS,
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
                    project: TSCONFIGS,
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
    // Shared packages import their own files through their own subpath imports,
    // such as `#ui/lib/utils`, declared under "imports" in the package's
    // package.json. Relative imports are not allowed, not even same-folder `./`
    // ones: a Vite config that imports a package hands its files to Node, which
    // only resolves an extensionless import through the "imports" map. `@/` means
    // "this app's src", so inside a package it would silently point at whichever
    // app is compiling it. A package importing itself by name only resolves
    // through the root package's node_modules, which the apps will not share.
    ...PACKAGES.map((name) => ({
        files: [`packages/${name}/src/**/*.{ts,tsx}`],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: ["./*", "../*"],
                            message: `Relative imports are not allowed in a shared package. Use this package's #${name}/ subpath imports instead.`,
                        },
                        {
                            group: ["@/*"],
                            message: `Shared packages cannot use the app-local @/ alias. Use this package's #${name}/ subpath imports, or import another package by name.`,
                        },
                        {
                            group: [`@energetica/${name}`, `@energetica/${name}/*`],
                            message: `Use this package's #${name}/ subpath imports for its own files.`,
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
