import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import reactDom from "eslint-plugin-react-dom";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import react from "eslint-plugin-react-x";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
    stylistic.configs.all,
    ...tseslint.config(
        {"ignores": ["dist"]},
        {
            "extends": [
                js.configs.recommended,
                ...tseslint.configs.strictTypeChecked,
                ...tseslint.configs.stylisticTypeChecked,
                react.configs.recommended,
                reactDom.configs.recommended,
                {
                    "languageOptions": {
                        "parserOptions": {
                            "projectService": true,
                            "tsconfigRootDir": import.meta.dirname
                        }
                    }
                }
            ],
            "files": ["**/*.{ts,tsx}"],
            "languageOptions": {
                "ecmaVersion": 2020,
                "globals": globals.browser
            },
            "plugins": {
                "react-hooks": reactHooks,
                "react-refresh": reactRefresh,
                "@stylistic": stylistic
            },
            "rules": {
                ...reactHooks.configs.recommended.rules,
                "react-refresh/only-export-components": [
                    "warn",
                    {"allowConstantExport": true}
                ],
                "@typescript-eslint/restrict-template-expressions": [
                    "error",
                    {
                        "allowNumber": true,
                        "allowBoolean": false,
                        "allowAny": false,
                        "allowNullish": false
                    }
                ],
                "@stylistic/padded-blocks": [
                    "error",
                    {
                        "blocks": "never"
                    }
                ]
            }
        }
    )
];
