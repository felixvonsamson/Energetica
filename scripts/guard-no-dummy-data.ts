/**
 * CI guard: fixture data must not reach a player-facing page (#971, decided in
 * #942).
 *
 * The defect this exists to stop actually shipped. `frontend/src/data/
 * dummyFacilities.ts` held 297 lines of hand-written facility records, and
 * `routes/app/facilities/manage.tsx` imported it behind `const SHOW_DUMMY_DATA
 * = false as boolean` — an assertion that exists purely to defeat type
 * narrowing, and therefore also defeats the bundler's dead-code elimination.
 * Both the toggle and the 297 lines went into every production bundle. The
 * module was deleted rather than gated: its stated purpose ("showcasing all
 * asset colors") is already served by `routes/app/internal/colors.tsx`, which
 * renders 32 facility types to the dummy module's 21.
 *
 * The rule is about the **import edge**, not the file. A fixture module nobody
 * imports is tree-shaken away and harms nothing; a fixture module imported by a
 * page is in the bundle no matter how the call site is guarded. So: a module
 * whose path names it as fixture data may only be imported from a test file or
 * from the internal design-system surface.
 *
 * `frontend/src/routes/app/internal/` is the sanctioned home. It ships to
 * production deliberately — it is a live, indexed design-system surface that
 * cannot rot the way a markdown description of the same colours did — so a
 * showcase belongs there, in the open, rather than hidden behind a constant in
 * a page players use.
 *
 * Known boundary: this matches module _names_, so a fixture array pasted inline
 * into a component, or a fixture module named `facility-samples-b.ts` with the
 * token in the wrong position, is not caught. That is accepted. The guard
 * removes the cheap, habitual version of the mistake — a file that announces
 * itself as dummy data and gets wired into a real page — not every conceivable
 * one.
 *
 * Run: `bun run guard:no-dummy-data` (from frontend/) or `bun
 * scripts/guard-no-dummy-data.ts`.
 */

import { execFileSync } from "child_process";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_PREFIX = "frontend/src/";

/**
 * Words that mark a module as fixture data. Matched against whole
 * hyphen-separated words in a filename stem and against whole path segments,
 * never as substrings.
 *
 * The list is deliberately short. `sample`, `seed` and `placeholder` were tried
 * and dropped: they are ordinary technical vocabulary here — a chart sample
 * rate, an RNG seed, an input placeholder — so a firing on `sample-rate.ts`
 * would get suppressed rather than fixed, which is exactly the kind of rule
 * #942 ruled out. What remains has no innocent reading as a module name.
 */
const FIXTURE_WORDS = new Set([
    "dummy",
    "dummies",
    "mock",
    "mocks",
    "fake",
    "fakes",
    "fixture",
    "fixtures",
    "stub",
    "stubs",
]);

/** Importers allowed to pull in fixture data. */
const ALLOWED_IMPORTERS = [
    /^frontend\/src\/routes\/app\/internal\//,
    /\.test\.tsx?$/,
    /^frontend\/src\/test\//,
];

/**
 * Match a module specifier: the target of `import … from`, a side-effect
 * `import`, a `require(...)`, or a dynamic `import(...)`. A bare quoted string
 * in prose or in a data literal is therefore not a false positive.
 */
const SPECIFIER_RE =
    /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'])([^"']+)\1/g;

/** Does this specifier name a module that is fixture data? */
function isFixtureSpecifier(specifier: string): boolean {
    // Only local modules — a third-party package called `mock-something` is
    // its own decision, made in package.json, not here.
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return false;

    const parts = specifier
        .split("/")
        .filter((p) => p && p !== "." && p !== "..");
    return parts.some((part) => {
        const stem = part.replace(/\.tsx?$/, "");
        return stem
            .split(/[-_.]/)
            .some((word) => FIXTURE_WORDS.has(word.toLowerCase()));
    });
}

function lineOf(source: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index; i++) if (source[i] === "\n") line++;
    return line;
}

const files = execFileSync("git", ["ls-files", SCAN_PREFIX], {
    cwd: REPO_ROOT,
    encoding: "utf8",
})
    .split("\n")
    .filter((f) => /\.tsx?$/.test(f))
    .sort();

const violations: string[] = [];

for (const file of files) {
    if (ALLOWED_IMPORTERS.some((re) => re.test(file))) continue;

    const source = readFileSync(join(REPO_ROOT, file), "utf8");
    SPECIFIER_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SPECIFIER_RE.exec(source)) !== null) {
        const specifier = m[2];
        if (isFixtureSpecifier(specifier)) {
            violations.push(
                `${file}:${lineOf(source, m.index)}  imports "${specifier}"`,
            );
        }
    }
}

if (violations.length === 0) {
    console.log(
        `✓ dummy-data guard: no fixture imports outside tests and /app/internal (${files.length} files scanned).`,
    );
    process.exit(0);
}

console.error("✗ dummy-data guard failed (#971).\n");
console.error(
    "Fixture data imported by a page ends up in the production bundle,\n" +
        "whatever the call site is guarded by — `const SHOW_X = false as boolean`\n" +
        "in particular defeats both type narrowing and tree shaking.\n\n" +
        "Offending imports:",
);
for (const v of violations) console.error(`  - ${v}`);
console.error(
    "\nEither delete the fixture, or move the showcase to\n" +
        "frontend/src/routes/app/internal/ where it is indexed and visible.\n" +
        "Test files may import fixtures freely.",
);

process.exit(1);
