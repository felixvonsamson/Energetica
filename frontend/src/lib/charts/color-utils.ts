/** Resolve a CSS custom property (e.g. `--primary`) to its computed value. */
export function resolveCSSVar(varName: string): string {
    if (typeof document === "undefined") return "#888";
    const root = document.documentElement;
    let val = getComputedStyle(root).getPropertyValue(varName).trim();
    const m = val.match(/^var\(([^,)]+)/);
    if (m?.[1]) val = getComputedStyle(root).getPropertyValue(m[1]).trim();
    return val || "#888";
}

/** Resolve a color string that may be a CSS `var(--…)` reference. */
export function resolveColor(color: string): string {
    if (!color.startsWith("var(")) return color;
    const varName = color.match(/^var\(([^,)]+)/)?.[1];
    if (!varName) return color;
    return resolveCSSVar(varName);
}

const contrastCache = new Map<string, string>();
let probeCanvas: HTMLCanvasElement | null = null;

/**
 * Rasterize any CSS color to sRGB bytes via a 1×1 canvas, or `null` if the
 * color is invalid or no canvas is available (SSR).
 *
 * Going through the canvas means we don't hand-parse each color space: the
 * browser converts `oklch()`, `hsl()`, named colors and every hex length to
 * sRGB for us — which matters here because the design tokens resolve to
 * `oklch()`.
 */
function colorToRgb(color: string): [number, number, number] | null {
    if (typeof document === "undefined") return null;
    if (!probeCanvas) {
        probeCanvas = document.createElement("canvas");
        probeCanvas.width = probeCanvas.height = 1;
    }
    const ctx = probeCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    // Validity probe: the fillStyle setter ignores an unparseable color, so it
    // reads back differently depending on the two known-different priors.
    ctx.fillStyle = "#000";
    ctx.fillStyle = color;
    const fromBlack = ctx.fillStyle;
    ctx.fillStyle = "#fff";
    ctx.fillStyle = color;
    if (ctx.fillStyle !== fromBlack) return null;

    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0];
}

/**
 * Pick black or white text for legibility over an arbitrary fill `color`.
 *
 * Accepts any CSS color or a `var(--…)` reference (resolved first). Falls back
 * to the theme foreground only when the color can't be rasterized at all.
 * Results are cached by resolved value, so a theme switch (which changes what a
 * `var()` resolves to) naturally recomputes under a new key. Used by
 * {@link MagnitudeBar} so labels stay readable over facility colors and
 * hash-assigned player colors alike, without a per-asset `-fg` CSS variable.
 */
export function readableTextColor(color: string): string {
    const resolved = resolveColor(color);
    const cached = contrastCache.get(resolved);
    if (cached) return cached;

    const rgb = colorToRgb(resolved);
    let result: string;
    if (rgb === null) {
        result = "var(--foreground)";
    } else {
        // Perceived luminance (sRGB weights). Bias slightly toward black text.
        const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
        result = luminance > 0.6 ? "#000" : "#fff";
    }

    contrastCache.set(resolved, result);
    return result;
}

/** Chart color palette using semantic CSS variables. */

export const CHART_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-6)",
] as const;
/**
 * Returns a consistent color from the chart palette based on a hash of the key.
 * Useful for assigning colors to dynamic data series (e.g., player names,
 * IDs).
 */

export function getHashBasedChartColor(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (
        CHART_COLORS[Math.abs(hash) % CHART_COLORS.length] ?? CHART_COLORS[0]
    );
}
