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
