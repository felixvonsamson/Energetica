/**
 * Utilities for smart chart data fetching based on cache inspection.
 * Allows incremental loading by detecting gaps in cached data.
 */

import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./query-client";

type Resolution = "1" | "6" | "36" | "216" | "1296";

export interface CachedTickRange {
    start_tick: number;
    end_tick: number; // exclusive (start_tick + count)
}

export interface SmartFetchRange {
    start_tick: number;
    count: number;
    shouldFetch: boolean;
    cached: CachedTickRange | null;
}

/**
 * Find all cached tick ranges for a given resolution and chart type.
 * Returns sorted ranges from oldest to newest.
 */
export function getCachedTickRanges(
    queryClient: QueryClient,
    chartType: "powerSources" | "powerSinks",
    resolution: Resolution,
): CachedTickRange[] {
    const cache = queryClient.getQueryCache();

    // Find all cached queries for this chart type and resolution
    const allQueries = cache.findAll();
    const relevantQueries = allQueries.filter((query) => {
        const key = query.queryKey;
        if (!Array.isArray(key)) return false;

        // Match pattern: ["charts", "power-sources/power-sinks", resolution, startTick, count]
        return (
            key[0] === "charts" &&
            key[1] ===
                `${chartType === "powerSources" ? "power-sources" : "power-sinks"}` &&
            key[2] === resolution &&
            typeof key[3] === "number" &&
            typeof key[4] === "number"
        );
    });

    // Extract and sort ranges by start_tick
    const ranges: CachedTickRange[] = relevantQueries
        .map((query) => {
            const key = query.queryKey as [
                string,
                string,
                string,
                number,
                number,
            ];
            const [, , , startTick, count] = key;
            return {
                start_tick: startTick,
                end_tick: startTick + count,
            };
        })
        .sort((a, b) => a.start_tick - b.start_tick);

    return ranges;
}

/**
 * Find the most recent (highest tick) cached data point for a given resolution.
 * Returns the tick value or null if no data is cached.
 */
export function getMostRecentCachedTick(
    queryClient: QueryClient,
    chartType: "powerSources" | "powerSinks",
    resolution: Resolution,
): number | null {
    const ranges = getCachedTickRanges(queryClient, chartType, resolution);
    if (ranges.length === 0) return null;

    // Return the end_tick of the last (most recent) range
    return ranges[ranges.length - 1].end_tick - 1;
}

/**
 * Determine what range should be fetched next, optionally filling gaps.
 * Useful for incrementally loading more historical data.
 *
 * @param queryClient - The React Query client
 * @param chartType - Type of chart (powerSources or powerSinks)
 * @param resolution - Data resolution
 * @param desiredStartTick - The tick you want to fetch from (usually most recent)
 * @param desiredCount - How many data points you want
 * @returns SmartFetchRange with start_tick, count, and whether to fetch
 */
export function getSmartFetchRange(
    queryClient: QueryClient,
    chartType: "powerSources" | "powerSinks",
    resolution: Resolution,
    desiredStartTick: number,
    desiredCount: number,
): SmartFetchRange {
    const ranges = getCachedTickRanges(queryClient, chartType, resolution);

    // No cached data - fetch everything
    if (ranges.length === 0) {
        return {
            start_tick: desiredStartTick,
            count: desiredCount,
            shouldFetch: true,
            cached: null,
        };
    }

    // Find if requested range overlaps with cached data
    const desiredEndTick = desiredStartTick + desiredCount;

    // Check if entire range is cached
    for (const range of ranges) {
        if (
            desiredStartTick >= range.start_tick &&
            desiredEndTick <= range.end_tick
        ) {
            return {
                start_tick: desiredStartTick,
                count: desiredCount,
                shouldFetch: false,
                cached: range,
            };
        }
    }

    // Partial overlap - fetch from the end of cached data
    const lastRange = ranges[ranges.length - 1];
    if (desiredStartTick < lastRange.end_tick) {
        const newStartTick = lastRange.end_tick;
        const newCount = Math.max(
            0,
            desiredStartTick + desiredCount - newStartTick,
        );
        return {
            start_tick: newStartTick,
            count: newCount,
            shouldFetch: newCount > 0,
            cached: lastRange,
        };
    }

    // No overlap - fetch the desired range
    return {
        start_tick: desiredStartTick,
        count: desiredCount,
        shouldFetch: true,
        cached: null,
    };
}

/**
 * Get all contiguous cached ranges, merging overlapping ones.
 * Useful for visualizing what data is available.
 */
export function getMergedCachedRanges(
    ranges: CachedTickRange[],
): CachedTickRange[] {
    if (ranges.length === 0) return [];

    const sorted = [...ranges].sort((a, b) => a.start_tick - b.start_tick);
    const merged: CachedTickRange[] = [];

    for (const range of sorted) {
        const lastMerged = merged[merged.length - 1];

        if (lastMerged && range.start_tick <= lastMerged.end_tick) {
            // Overlapping or adjacent - merge
            lastMerged.end_tick = Math.max(lastMerged.end_tick, range.end_tick);
        } else {
            // No overlap - add as new range
            merged.push({ ...range });
        }
    }

    return merged;
}
