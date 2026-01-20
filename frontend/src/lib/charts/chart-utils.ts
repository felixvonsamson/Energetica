/** Utility functions for chart data processing. */

/**
 * Default filter that excludes data keys where all values are zero. Useful for
 * removing series that have no data.
 */
export function filterNonZeroSeries(key: string, data: unknown[]): boolean {
    return data.some((dataPoint) => {
        const value = (dataPoint as Record<string, unknown>)[key] ?? 0;
        return typeof value === "number" && value > 0;
    });
}

/** Creates a filter that excludes specific keys. */
export function createExcludeKeysFilter(excludeKeys: string[]) {
    return (key: string, _data: unknown[]): boolean => {
        return !excludeKeys.includes(key);
    };
}

/** Creates a filter that only includes specific keys. */
export function createIncludeKeysFilter(includeKeys: string[]) {
    return (key: string, _data: unknown[]): boolean => {
        return includeKeys.includes(key);
    };
}

/** Chart color palette using semantic CSS variables. */
export const CHART_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-6)",
    "var(--chart-7)",
    "var(--chart-8)",
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
