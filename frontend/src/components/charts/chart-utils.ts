/** Utility functions for chart data processing. */

/**
 * Default filter that excludes data keys where all values are zero. Useful for
 * removing series that have no data.
 */
export function filterNonZeroSeries(key: string, data: any[]): boolean {
    return data.some(
        (dataPoint) => ((dataPoint as Record<string, any>)[key] ?? 0) > 0,
    );
}

/** Filter that includes all data keys (no filtering). */
export function includeAllSeries(_key: string, _data: any[]): boolean {
    return true;
}

/** Creates a filter that excludes specific keys. */
export function createExcludeKeysFilter(excludeKeys: string[]) {
    return (key: string, _data: any[]): boolean => {
        return !excludeKeys.includes(key);
    };
}

/** Creates a filter that only includes specific keys. */
export function createIncludeKeysFilter(includeKeys: string[]) {
    return (key: string, _data: any[]): boolean => {
        return includeKeys.includes(key);
    };
}
