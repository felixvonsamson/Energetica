import { createRequire } from "node:module";

// Prettier is installed in frontend/ only, but this config sits at the repo root so it
// also covers the docs. Resolve the plugin from frontend/, where it is installed;
// a bare plugin name would be looked up from the root and not found.
const fromFrontend = createRequire(
    new URL("./frontend/package.json", import.meta.url),
);

export default {
    semi: true,
    tabWidth: 4,
    plugins: [fromFrontend.resolve("prettier-plugin-jsdoc")],
    proseWrap: "preserve",
    overrides: [
        {
            files: ["*.md", "*.yaml", "*.yml"],
            options: { tabWidth: 2 },
        },
    ],
};
