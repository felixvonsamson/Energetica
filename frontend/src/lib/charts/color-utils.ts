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

/**
 * Pick black or white text for legibility over an arbitrary fill `color`.
 *
 * Accepts a resolved `rgb()/rgba()/#hex` value or a `var(--…)` reference
 * (resolved first). Falls back to the theme foreground for anything it can't
 * parse. Used by {@link MagnitudeBar} so labels stay readable over both facility
 * colors and hash-assigned player colors, without relying on a per-asset `-fg`
 * CSS variable.
 */
export function readableTextColor(color: string): string {
    const c = resolveColor(color);
    let r = NaN;
    let g = NaN;
    let b = NaN;

    const rgb = c.match(/rgba?\(([^)]+)\)/);
    if (rgb?.[1]) {
        const parts = rgb[1].split(",");
        r = parseFloat(parts[0] ?? "");
        g = parseFloat(parts[1] ?? "");
        b = parseFloat(parts[2] ?? "");
    } else if (c.startsWith("#")) {
        const hex = c.slice(1);
        const full =
            hex.length === 3
                ? hex
                      .split("")
                      .map((h) => h + h)
                      .join("")
                : hex;
        r = parseInt(full.slice(0, 2), 16);
        g = parseInt(full.slice(2, 4), 16);
        b = parseInt(full.slice(4, 6), 16);
    } else {
        return "var(--foreground)";
    }

    if ([r, g, b].some((v) => Number.isNaN(v))) return "var(--foreground)";

    // Perceived luminance (sRGB weights). Bias slightly toward black text.
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#000" : "#fff";
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
