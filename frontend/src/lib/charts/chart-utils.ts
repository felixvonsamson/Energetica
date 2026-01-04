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
    return (key: string): boolean => {
        return !excludeKeys.includes(key);
    };
}

/** Creates a filter that only includes specific keys. */
export function createIncludeKeysFilter(includeKeys: string[]) {
    return (key: string): boolean => {
        return includeKeys.includes(key);
    };
}
