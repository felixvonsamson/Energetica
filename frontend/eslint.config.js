import reactHooks from "eslint-plugin-react-hooks";
import jsdoc from "eslint-plugin-jsdoc";
import { defineConfig } from "eslint/config";

export default defineConfig([
    {
        ignores: ["node_modules/", "dist/"],
    },
    reactHooks.configs.flat["recommended-latest"],
    jsdoc.configs["flat/recommended"],
]);
