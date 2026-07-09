/**
 * CI guard: forbid raw-HTML rendering of user-generated content (ADR-0002, #843).
 *
 * With the shared parent-domain SSO cookie live in production, the sole live
 * defence against a cross-instance session-ride is that every user-controlled
 * string renders as React-escaped text. This guard fails CI if any frontend
 * source introduces a raw-HTML sink — `dangerouslySetInnerHTML` or `rehype-raw`
 * — outside the explicit allowlist below.
 *
 * The allowlist is intentionally tiny and granular: it pins each permitted sink
 * to both its file AND the exact expression fed to `__html`. Adding a new UGC
 * surface, or changing an allowlisted site to render a different (possibly
 * user-controlled) field, therefore requires a visible, security-reviewable
 * edit to this file — it can never slip in silently.
 *
 * Run: `bun run guard:no-raw-html` (from frontend/) or `bun scripts/guard-no-raw-html.ts`.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_ROOT = join(REPO_ROOT, "frontend", "src");

/**
 * Every currently-permitted `dangerouslySetInnerHTML` sink.
 *
 * `file` is repo-relative; `html` is the exact expression passed to `__html`.
 * Both must match for a usage to be allowed. All current entries render
 * developer-authored game content (technology / facility descriptions), never
 * user-generated content.
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

    // rehype-raw re-enables raw HTML inside react-markdown; forbidden outright,
    // matched on the package name (import) and the conventional identifier.
    const rawRe = /rehype-raw|rehypeRaw/g;
    let m: RegExpExecArray | null;
    while ((m = rawRe.exec(source)) !== null) {
        findings.push({
            file,
            line: lineOf(source, m.index),
            kind: "rehype-raw",
        });
    }
}

// Match findings against the allowlist. An allowlist entry is "used" only when
// a real finding matches it, so stale entries surface as errors and the list
// stays truthful and minimal.
const used = new Set<number>();
const violations: string[] = [];

for (const f of findings) {
    if (f.kind === "rehype-raw") {
        violations.push(
            `${f.file}:${f.line}  raw-HTML markdown (rehype-raw) is forbidden`,
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
        (a) => a.file === f.file && a.html === f.html,
    );
    if (allowIdx === -1) {
        violations.push(
            `${f.file}:${f.line}  dangerouslySetInnerHTML={{ __html: ${f.html} }} is not allowlisted`,
        );
    } else {
        used.add(allowIdx);
    }
}

const stale = ALLOWLIST.filter((_, i) => !used.has(i));

if (violations.length === 0 && stale.length === 0) {
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

if (stale.length > 0) {
    console.error("\nStale ALLOWLIST entries (no matching sink found):");
    for (const s of stale) console.error(`  - ${s.file}  __html: ${s.html}`);
    console.error(
        "\nRemove them from scripts/guard-no-raw-html.ts so the allowlist stays minimal.",
    );
}

process.exit(1);
