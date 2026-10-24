import { existsSync, readdirSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const FRONTEND_ROOT = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../frontend",
);

/**
 * The names of the workspace packages in `frontend/apps` or
 * `frontend/packages`. Only folders with a package.json count, so stray files
 * such as macOS's `.DS_Store` are skipped.
 */
export function frontendWorkspaces(group: "apps" | "packages"): string[] {
    return readdirSync(join(FRONTEND_ROOT, group))
        .filter((name) =>
            existsSync(join(FRONTEND_ROOT, group, name, "package.json")),
        )
        .sort();
}
