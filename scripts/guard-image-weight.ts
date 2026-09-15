/**
 * CI guard: the served image tree stays small (#1073).
 *
 * `src/energetica/static/images/` was 111 MB of unoptimized PNGs, 53 MB of it
 * seven landing-page banners exported straight from one pipeline at
 * 2000x900x4 bytes with the compressor effectively switched off. Every visitor
 * paid for that on first load. Converting the tree to WebP took it to ~5 MB.
 *
 * The point of this guard is that the next export cannot quietly undo that. It
 * is cheap to drag a fresh PNG into the tree and never notice; the failure is
 * invisible locally, where the file is already on disk, and only shows up as a
 * slow landing page for someone else.
 *
 * Two rules, and both matter:
 *
 * 1. **Raster images are WebP.** This is the rule that catches the actual
 *    mistake. A size limit alone would let a 300 KB PNG through, and then the
 *    tree drifts back to mixed formats one file at a time.
 * 2. **No file exceeds MAX_BYTES.** WebP is not automatically small — a photo
 *    saved at full camera resolution is still heavy. This catches an image that
 *    is the right format but the wrong dimensions.
 *
 * `scripts/dev/optimize_images.py` produces conforming files, and its width and
 * quality table explains the numbers it picks.
 *
 * Run: `bun run guard:image-weight` (from frontend/) or `bun
 * scripts/guard-image-weight.ts`.
 */

import { execFileSync } from "child_process";
import { statSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IMAGE_ROOT = "src/energetica/static/images/";

/**
 * Ceiling for a single served image.
 *
 * The largest conforming file today is ~290 KB (the landing hero banner), so
 * this leaves real headroom for a legitimately detailed new image while still
 * catching a full-resolution export, which lands in the megabytes.
 */
const MAX_BYTES = 400 * 1024;

/**
 * Raster formats that must be WebP instead. SVG is exempt: it is vector, so it
 * has no resolution to get wrong, and converting it would be a downgrade.
 *
 * This is deliberately wider than what `optimize_images.py` can read, which is
 * PNG and JPEG. The rule worth enforcing is "the served tree is WebP", and
 * narrowing it to the formats one script happens to accept would let a heavy
 * GIF through. The failure message says which formats the script handles so
 * that it does not promise a fix it cannot deliver.
 */
const RASTER_TO_CONVERT = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff"];

/** Formats `scripts/dev/optimize_images.py` can convert without extra work. */
const SCRIPT_HANDLES = [".png", ".jpg", ".jpeg"];

/**
 * Files that stay PNG on purpose, named one by one rather than by directory.
 *
 * `icon_green.png` is the PWA icon, which `frontend/public/manifest.json`
 * declares as `"type": "image/png"`, and is also the icon a Web Push
 * notification renders. `icons/quiz.png` is 3.5 KB, where converting buys
 * nothing.
 *
 * Exempting all of `icons/` would be easier to write and wrong: it would wave
 * through a heavy PNG dropped in there later, which is the mistake this guard
 * exists to catch. A new icon either converts like everything else or earns its
 * own line here with a reason.
 */
const FORMAT_EXEMPT = [/^icon_green\.png$/, /^icons\/quiz\.png$/];

/** Tracked files under the image tree, as paths relative to that tree. */
function trackedImages(): string[] {
    const out = execFileSync("git", ["ls-files", IMAGE_ROOT], {
        cwd: REPO_ROOT,
        encoding: "utf8",
    });
    return out
        .split("\n")
        .filter(Boolean)
        .map((f) => f.slice(IMAGE_ROOT.length))
        .sort();
}

function kb(bytes: number): string {
    return `${Math.round(bytes / 1024)} KB`;
}

const files = trackedImages();
const violations: string[] = [];

for (const file of files) {
    const extension = file.slice(file.lastIndexOf(".")).toLowerCase();
    const exempt = FORMAT_EXEMPT.some((pattern) => pattern.test(file));

    if (RASTER_TO_CONVERT.includes(extension) && !exempt) {
        violations.push(
            SCRIPT_HANDLES.includes(extension)
                ? `${file}  — ${extension} must be WebP`
                : `${file}  — ${extension} must be WebP, and optimize_images.py cannot read it; convert it by hand`,
        );
    }

    const bytes = statSync(resolve(REPO_ROOT, IMAGE_ROOT, file)).size;
    if (bytes > MAX_BYTES) {
        violations.push(
            `${file}  — ${kb(bytes)} exceeds the ${kb(MAX_BYTES)} ceiling; resize it to the size it renders at`,
        );
    }
}

if (violations.length === 0) {
    console.log(
        `✓ image weight guard: ${files.length} files, WebP apart from the` +
            ` documented exemptions, none over ${kb(MAX_BYTES)}.`,
    );
    process.exit(0);
}

console.error("✗ image weight guard failed (#1073).\n");
console.error(
    "Images under src/energetica/static/images/ are served to every visitor,\n" +
        "so they are WebP and sized for the box they render in.\n\n" +
        "Offending files:",
);
for (const violation of violations) console.error(`  - ${violation}`);
console.error(
    "\nConverting a PNG or JPEG export is one command:\n\n" +
        "    python scripts/dev/optimize_images.py\n\n" +
        "That script holds the width and quality table, and explains each number.",
);

process.exit(1);
