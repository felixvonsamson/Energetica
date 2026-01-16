import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import jsdoc from "eslint-plugin-jsdoc";
import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
    {
        ignores: ["node_modules/", "dist/", "*.config.ts", "*.config.js"],
    },
    ...tseslint.configs.recommended,
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
            react: react,
        },
        settings: {
            "import/resolver": {
                typescript: {
                    alwaysTryTypes: true,
                    project: "./tsconfig.json",
                },
                node: true,
            },
            "import/internal-regex": "^@/",
            react: {
                version: "detect",
            },
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
            // React-specific rules
            "react/jsx-key": "error",
            "react/jsx-no-target-blank": "error",
            "react/no-array-index-key": "warn",
            "react/no-children-prop": "error",
            "react/no-danger-with-children": "error",
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
            "import/no-duplicates": "error",
        },
    },
    reactHooks.configs.flat["recommended-latest"],
    // jsdoc.configs["flat/recommended"],
]);
