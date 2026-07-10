/**
 * CI guard: forbid raw-HTML rendering of user-generated content (ADR-0002,
 * #843).
 *
 * With the shared parent-domain SSO cookie live in production, the sole live
 * defence against a cross-instance session-ride is that every user-controlled
 * string renders as React-escaped text. This guard fails CI if any frontend
 * source introduces a raw-HTML sink outside the explicit allowlist below.
 *
 * Two sinks are covered:
 *
 * 1. `dangerouslySetInnerHTML` — a JSX-level sink, so it is only scanned in
 *    `frontend/src`. Each occurrence is pinned to a (file, __html-expression)
 *    allowlist entry, consumed 1:1: a second sink — even one that reuses the
 *    same expression text in a different scope — needs its own reviewable
 *    entry, so a refactor cannot silently ride an existing approval.
 * 2. `rehype-raw` — re-enables raw HTML inside our build-time MDX pipeline. MDX
 *    plugins are wired in `frontend/vite.config*.ts` (never in `src`), so a
 *    `src`-only scan would miss it entirely. It is forbidden outright at two
 *    layers that together defeat aliasing / wrapper indirection: (a) it must
 *    not be a declared dependency (or npm-aliased dependency) in
 *    `frontend/package.json` — no package present, nothing to import; (b) its
 *    module specifier must not be imported anywhere in `frontend/src` or the
 *    build configs.
 *
 * The allowlist is intentionally tiny and granular. Adding a new UGC surface,
 * or changing an allowlisted site to render a different (possibly
 * user-controlled) field, requires a visible, security-reviewable edit to this
 * file — it can never slip in silently.
 *
 * Run: `bun run guard:no-raw-html` (from frontend/) or `bun
 * scripts/guard-no-raw-html.ts`.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FRONTEND_ROOT = join(REPO_ROOT, "frontend");
const SCAN_ROOT = join(FRONTEND_ROOT, "src");

/**
 * Every currently-permitted `dangerouslySetInnerHTML` sink.
 *
 * `file` is repo-relative; `html` is the exact expression passed to `__html`.
 * Both must match for a usage to be allowed, and entries are consumed one per
 * physical sink: two sinks in the same file need two entries. All current
 * entries render developer-authored game content (technology / facility
 * descriptions), never user-generated content.
 *
 * DO NOT extend this list to cover any user-controlled string (chat, player /
 * team / tile names, or any future rich field). See ADR-0002.
 */
const ALLOWLIST: { file: string; html: string }[] = [
    {
        file: "frontend/src/components/technologies/technology-detail-dialog.tsx",
        html: "displayedTechnology.description",
    },
    {
        file: "frontend/src/components/facilities/facility-detail-dialog.tsx",
        html: "facility.description",
    },
    {
        file: "frontend/src/routes/app/facilities/extraction.tsx",
        html: "facility.description",
    },
    {
        file: "frontend/src/routes/app/facilities/functional.tsx",
        html: "facility.description",
    },
    {
        file: "frontend/src/routes/app/facilities/power.tsx",
        html: "facility.description",
    },
];

/** The forbidden raw-HTML MDX plugin. */
const RAW_MD_PACKAGE = "rehype-raw";

interface Finding {
    file: string; // repo-relative
    line: number;
    kind: "dangerouslySetInnerHTML" | "rehype-raw";
    html?: string; // expression passed to __html, when parseable
}

/** Recursively collect .ts/.tsx source files under `dir`. */
function collectSources(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            out.push(...collectSources(full));
        } else if (/\.tsx?$/.test(entry)) {
            out.push(full);
        }
    }
    return out;
}

/** Non-recursive .ts/.tsx files directly under `dir` (e.g. build configs). */
function collectTopLevel(dir: string): string[] {
    return readdirSync(dir)
        .filter((e) => /\.tsx?$/.test(e))
        .map((e) => join(dir, e))
        .filter((f) => statSync(f).isFile());
}

function lineOf(source: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index; i++) if (source[i] === "\n") line++;
    return line;
}

/**
 * Extract the `__html` expression that follows a `dangerouslySetInnerHTML`
 * occurrence at `from`. Returns the trimmed expression, or undefined if the
 * usage does not match the expected `{{ __html: <expr> }}` shape — an
 * unparseable sink is treated as a violation, never waved through.
 */
function extractHtmlExpr(source: string, from: number): string | undefined {
    const rest = source.slice(from, from + 400);
    const m = rest.match(/__html\s*:\s*([\s\S]+?)\s*[,}]/);
    return m ? m[1].trim() : undefined;
}

const findings: Finding[] = [];

// `dangerouslySetInnerHTML` is a JSX sink: scan application sources only.
for (const absFile of collectSources(SCAN_ROOT)) {
    const file = relative(REPO_ROOT, absFile);
    const source = readFileSync(absFile, "utf8");

    for (
        let idx = source.indexOf("dangerouslySetInnerHTML");
        idx !== -1;
        idx = source.indexOf("dangerouslySetInnerHTML", idx + 1)
    ) {
        findings.push({
            file,
            line: lineOf(source, idx),
            kind: "dangerouslySetInnerHTML",
            html: extractHtmlExpr(source, idx),
        });
    }
}

// `rehype-raw` re-enables raw HTML inside react-markdown / MDX. Match only an
// actual quoted module specifier (`"rehype-raw"` / `'rehype-raw'`), so prose or
// a comment that merely names the package cannot trip CI. Scan both the app
// sources and the build configs, where MDX `rehypePlugins` are actually wired.
const rawSpecifierRe = new RegExp(
    `["']${RAW_MD_PACKAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
    "g",
);
const rawScanFiles = [
    ...collectSources(SCAN_ROOT),
    ...collectTopLevel(FRONTEND_ROOT),
];
for (const absFile of rawScanFiles) {
    const file = relative(REPO_ROOT, absFile);
    const source = readFileSync(absFile, "utf8");
    let m: RegExpExecArray | null;
    while ((m = rawSpecifierRe.exec(source)) !== null) {
        findings.push({
            file,
            line: lineOf(source, m.index),
            kind: "rehype-raw",
        });
    }
}

// Dependency-level block: an aliased or wrapped import still needs `rehype-raw`
// present as a (possibly npm-aliased) dependency. Scan the manifest's keys AND
// values so `"anything": "npm:rehype-raw@^7"` is caught too.
const depViolations: string[] = [];
const pkgPath = join(FRONTEND_ROOT, "package.json");
if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<
        string,
        unknown
    >;
    const depSections = [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
    ];
    for (const section of depSections) {
        const deps = pkg[section];
        if (!deps || typeof deps !== "object") continue;
        for (const [name, version] of Object.entries(
            deps as Record<string, string>,
        )) {
            if (
                name === RAW_MD_PACKAGE ||
                String(version).includes(RAW_MD_PACKAGE)
            ) {
                depViolations.push(
                    `frontend/package.json  ${section}["${name}"] pulls in ${RAW_MD_PACKAGE}`,
                );
            }
        }
    }
}

// Match findings against the allowlist. Entries are consumed one-per-sink: a
// finding claims the first *unconsumed* matching entry, so a duplicate sink
// with no dedicated entry (even same file + same expression, different scope)
// surfaces as a violation. Unconsumed entries are stale, keeping the list
// truthful and minimal.
const consumed = new Array<boolean>(ALLOWLIST.length).fill(false);
const violations: string[] = [];

for (const f of findings) {
    if (f.kind === "rehype-raw") {
        violations.push(
            `${f.file}:${f.line}  raw-HTML markdown (${RAW_MD_PACKAGE}) is forbidden`,
        );
        continue;
    }
    if (f.html === undefined) {
        violations.push(
            `${f.file}:${f.line}  dangerouslySetInnerHTML with an unrecognised shape — ` +
                `cannot verify the rendered value is not user-controlled`,
        );
        continue;
    }
    const allowIdx = ALLOWLIST.findIndex(
        (a, i) => !consumed[i] && a.file === f.file && a.html === f.html,
    );
    if (allowIdx === -1) {
        violations.push(
            `${f.file}:${f.line}  dangerouslySetInnerHTML={{ __html: ${f.html} }} is not allowlisted`,
        );
    } else {
        consumed[allowIdx] = true;
    }
}

const stale = ALLOWLIST.filter((_, i) => !consumed[i]);

if (
    violations.length === 0 &&
    depViolations.length === 0 &&
    stale.length === 0
) {
    console.log(
        `✓ raw-HTML UGC guard: ${ALLOWLIST.length} allowlisted sink(s), no violations.`,
    );
    process.exit(0);
}

console.error("✗ raw-HTML UGC guard failed (ADR-0002, #843).\n");

if (violations.length > 0) {
    console.error(
        "Raw-HTML sinks render their input as unescaped markup. On any\n" +
            "user-controlled string this is a stored-XSS / cross-instance\n" +
            "session-ride vector. Render UGC as React-escaped text instead.\n\n" +
            "Disallowed sinks:",
    );
    for (const v of violations) console.error(`  - ${v}`);
    console.error(
        "\nIf (and only if) the rendered value is developer-authored game\n" +
            "content, add an explicit { file, html } entry to ALLOWLIST in\n" +
            "scripts/guard-no-raw-html.ts — that edit gets security review.",
    );
}

if (depViolations.length > 0) {
    console.error(
        `\n${RAW_MD_PACKAGE} must not be a dependency — its presence lets any\n` +
            "module re-enable raw HTML in the MDX pipeline, defeating this guard.\n\n" +
            "Offending manifest entries:",
    );
    for (const v of depViolations) console.error(`  - ${v}`);
}

if (stale.length > 0) {
    console.error("\nStale ALLOWLIST entries (no matching sink found):");
    for (const s of stale) console.error(`  - ${s.file}  __html: ${s.html}`);
    console.error(
        "\nRemove them from scripts/guard-no-raw-html.ts so the allowlist stays minimal.",
    );
}

process.exit(1);
