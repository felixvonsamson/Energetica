// @ts-nocheck
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import pluginQuery from "@tanstack/eslint-plugin-query";

export default defineConfig([
    {
        ignores: ["node_modules/", "dist/", "*.config.ts", "*.config.js"],
    },
    ...tseslint.configs.recommended,
    react.configs.flat.recommended,
    {
        files: ["src/**/*.{ts,tsx}"],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                ecmaFeatures: {
                    jsx: true,
                },
                project: "./tsconfig.json",
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
            react: {
                version: "detect",
            },
            "import/resolver": {
                typescript: {
                    alwaysTryTypes: true,
                    project: "./tsconfig.json",
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
        },
    },
    reactHooks.configs.flat["recommended-latest"],
    jsxA11y.flatConfigs.recommended,
    ...pluginQuery.configs["flat/recommended"],
]);
