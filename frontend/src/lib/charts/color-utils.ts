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
