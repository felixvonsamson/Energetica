/**
 * CI guard: every source file under `frontend/src` is named in kebab-case
 * (#971, decided in #942).
 *
 * This guard pins reality rather than imposing a preference. All 321 tracked
 * `.ts` / `.tsx` files under `frontend/src` already follow the grammar below;
 * the prose that used to assert `PascalCase.tsx` was wrong about its own
 * codebase, and was deleted in favour of this check.
 *
 * The grammar has three parts, and the carve-outs are the substance of it:
 *
 * 1. **Generated files are exempt.** A `.gen.ts` or `.generated.ts` name is chosen
 *    by the tool that writes it (`routeTree.gen.ts` by the TanStack Router
 *    plugin, `api.generated.ts` by `bun run generate-types`), so it is not ours
 *    to rename. Exempting by suffix means new generated files need no allowlist
 *    edit — an allowlist here would rot on the first added route tree.
 * 2. **Known compound suffixes are stripped before the stem is judged**: `.d.ts`
 *    (ambient declarations) and `.test.ts` / `.test.tsx` (vitest). Without
 *    this, `single-origin.test.ts` would fail on a dot it is required to have.
 * 3. **Inside the three route trees, the stem is a TanStack file-based route path,
 *    not a plain name.** `runs.$slug.recap.tsx` is three route segments,
 *    `$slug.tsx` is a path parameter and `__root.tsx` is the root layout —
 *    framework syntax, not sloppy naming. Each dot-separated segment is checked
 *    individually, so `routes/app/DashboardCard.tsx` still fails.
 *
 * Run: `bun run guard:filenames` (from frontend/) or `bun
 * scripts/guard-filenames.ts`.
 */

import { execFileSync } from "child_process";
import { basename, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_PREFIX = "frontend/src/";

/** Route trees where TanStack's file-based route syntax applies. */
const ROUTE_TREES = [
    "frontend/src/routes/",
    "frontend/src/routes-landing/",
    "frontend/src/routes-lobby/",
];

/** Suffixes whose names are written by a tool, not by us. */
const GENERATED_SUFFIXES = [".gen.ts", ".gen.tsx", ".generated.ts"];

/** Compound suffixes stripped before the stem is judged. */
const COMPOUND_SUFFIXES = [".d.ts", ".test.ts", ".test.tsx"];

/** A plain kebab-case name: lowercase alphanumeric words joined by hyphens. */
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * One segment of a TanStack file-based route path. Either kebab-case, or one of
 * the framework's sigils: `$param` / `$` (splat), `_layout` (pathless layout),
 * `__root` (the root route).
 */
const ROUTE_SEGMENT =
    /^(__root|_[a-z0-9]+(-[a-z0-9]+)*|\$[a-z0-9]*|[a-z0-9]+(-[a-z0-9]+)*)$/;

/** Tracked `.ts` / `.tsx` files under `frontend/src`, repo-relative. */
function trackedSources(): string[] {
    const out = execFileSync("git", ["ls-files", SCAN_PREFIX], {
        cwd: REPO_ROOT,
        encoding: "utf8",
    });
    return out
        .split("\n")
        .filter((f) => /\.tsx?$/.test(f))
        .sort();
}

/** The part of a filename to judge, with any known suffix stripped. */
function stemOf(name: string): string {
    for (const suffix of COMPOUND_SUFFIXES) {
        if (name.endsWith(suffix)) return name.slice(0, -suffix.length);
    }
    return name.slice(0, name.lastIndexOf("."));
}

const violations: string[] = [];

for (const file of trackedSources()) {
    const name = basename(file);

    if (GENERATED_SUFFIXES.some((s) => name.endsWith(s))) continue;

    const stem = stemOf(name);
    const inRouteTree = ROUTE_TREES.some((prefix) => file.startsWith(prefix));

    const ok = inRouteTree
        ? stem.split(".").every((segment) => ROUTE_SEGMENT.test(segment))
        : KEBAB.test(stem);

    if (!ok) {
        violations.push(
            inRouteTree
                ? `${file}  — route path segments must be kebab-case, \`$param\`, \`_layout\` or \`__root\``
                : `${file}  — expected a kebab-case name, e.g. \`${toKebab(stem)}\``,
        );
    }
}

/** Best-effort kebab rendering of an offending stem, for the error message. */
function toKebab(stem: string): string {
    return stem
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[_\s]+/g, "-")
        .toLowerCase();
}

if (violations.length === 0) {
    console.log("✓ filename guard: all frontend/src sources are kebab-case.");
    process.exit(0);
}

console.error("✗ filename guard failed (#971).\n");
console.error(
    "Every source file under frontend/src is named in kebab-case. Generated\n" +
        "files (`*.gen.ts`, `*.generated.ts`) are exempt, `.d.ts` and `.test.ts`\n" +
        "suffixes are allowed, and inside the route trees TanStack's file-based\n" +
        "route syntax applies.\n\nOffending files:",
);
for (const v of violations) console.error(`  - ${v}`);
console.error(
    "\nRename the file with `git mv` and fix its importers. If the name is\n" +
        "dictated by a tool, add its suffix to GENERATED_SUFFIXES in\n" +
        "scripts/guard-filenames.ts.",
);

process.exit(1);
