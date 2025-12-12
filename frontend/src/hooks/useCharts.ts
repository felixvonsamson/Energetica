/**
 * Charts data fetching and aggregation hooks.
 *
 * Provides intelligent caching and data aggregation for time-series chart data.
 * Coordinates between multiple cached query ranges to minimize API calls while
 * ensuring complete coverage of the requested time range.
 *
 * Key Concepts:
 *
 * - QueryClient: dynamically read all previously run chart queries.
 * - Smart fetching fills gaps in cache coverage with minimal requests.
 * - Each resolution has its own API and its own cached queries.
 * - Each datapoint at resolution N represents an average over N ticks.
 * - The `count` variable is a number of datapoints.
 * - Tick ranges are [) i.e. inclusive on left and exclusive on right.
 */

import {
    Query,
    QueryClient,
    useQueries,
    useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";

import {
    ChartType,
    Resolution,
    TickRange,
    toStringResolution,
} from "../types/charts";

import { chartsApi } from "@/lib/api/charts";
import {
    POWER_GENERATION_KEYS,
    POWER_CONSUMPTION_KEYS,
    STORAGE_LEVEL_KEYS,
    REVENUES_KEYS,
    OP_COSTS_KEYS,
    reorderObjectKeys,
} from "@/lib/chart-key-order";
import { queryKeys } from "@/lib/query-client";

/** Map chart types to their corresponding key ordering */
const KEY_ORDER_BY_CHART_TYPE: Record<ChartType, readonly string[]> = {
    "power-sources": POWER_GENERATION_KEYS,
    "power-sinks": POWER_CONSUMPTION_KEYS,
    "storage-level": STORAGE_LEVEL_KEYS,
    revenues: REVENUES_KEYS,
    "op-costs": OP_COSTS_KEYS,
};

/** Main exported hook. Returns all chart datapoints relevant to the request. */
export function useCurrentChartData({
    chartType,
    currentTick,
    resolution,
    maxDatapoints,
}: {
    chartType: ChartType;
    currentTick: number | undefined;
    resolution: Resolution;
    maxDatapoints: number;
}) {
    // Determine the corresponding tick range
    const range = useMemo(() => {
        if (!currentTick) {
            return { startTick: 0, count: 0 };
        }
        const startTick =
            resolution *
            Math.max(0, Math.floor(currentTick / resolution - maxDatapoints));
        const count = Math.floor((currentTick - startTick) / resolution);
        return { startTick, count };
    }, [currentTick, resolution, maxDatapoints]);

    // Call helper hook (always called, handles empty range gracefully)
    const {
        data: chartData,
        isLoading,
        isError,
    } = useChartData({ chartType, range, resolution });

    // Return empty state if currentTick is not loaded
    if (!currentTick) {
        return { chartData: [], isLoading: true, isError: false };
    }

    return { chartData, isLoading, isError };
}

/**
 * Aggregates chart data from multiple cached query ranges.
 *
 * Combines data from multiple cache entries to construct a complete time series
 * for the requested range. Triggers fetches for missing data ranges and waits.
 */
export function useChartData({
    chartType,
    resolution,
    range,
}: {
    chartType: ChartType;
    resolution: Resolution;
    range: TickRange;
}) {
    const queryClient = useQueryClient();

    const rangesToFetch = getCacheGaps({
        queryClient,
        chartType,
        resolution,
        range,
    });

    const allCachedRanges = getCachedChartRanges({
        queryClient,
        chartType,
        resolution,
        range,
    });

    const { isLoading, isError } = useFetchChartGaps({
        chartType,
        resolution,
        rangesToFetch,
    });

    const aggregatedData = useMemo(() => {
        // Calculate the exclusive end tick of the desired range
        const endTick = range.startTick + range.count * resolution;

        // Map of tick -> {source1: value, source2: value, ...}
        const tickMap = new Map<number, Record<string, number>>();

        // Aggregate data from all overlapping cached ranges
        for (const cached of allCachedRanges) {
            const rangeEndTick =
                cached.range.startTick + cached.range.count * resolution;

            // Iterate through ticks in the overlap, stepping by index
            const startIndex =
                (Math.max(cached.range.startTick, range.startTick) -
                    cached.range.startTick) /
                resolution;
            const endIndex =
                (Math.min(rangeEndTick, endTick) - cached.range.startTick) /
                resolution;
            for (let i = startIndex; i < endIndex; i += 1) {
                const tick = i * resolution + cached.range.startTick;
                if (!tickMap.has(tick)) tickMap.set(tick, {});
                const tickData = tickMap.get(tick)!;
                // Copy all power source values for this tick
                Object.entries(cached.data.series).forEach(
                    ([source, values]: [string, number[]]) => {
                        tickData[source] = values[i] ?? 0;
                    },
                );
            }
        }
        // Convert from Map (tick->{data}) to list of entries [{tick+data}]
        const keyOrder = KEY_ORDER_BY_CHART_TYPE[chartType];

        const result = Array.from(tickMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([tick, sources]) => {
                const reorderedSources = reorderObjectKeys(sources, keyOrder);
                return {
                    tick,
                    ...reorderedSources,
                };
            });

        // console.log("result:", result);
        return result;
    }, [allCachedRanges, chartType, range.startTick, range.count, resolution]);

    return {
        data: isLoading ? [] : aggregatedData,
        isLoading,
        isError,
    };
}

/** Map chart types to their corresponding query key functions */
const QUERY_KEY_FN_BY_CHART_TYPE = {
    "power-sources": queryKeys.charts.powerSources,
    "power-sinks": queryKeys.charts.powerSinks,
    "storage-level": queryKeys.charts.storageLevel,
    revenues: queryKeys.charts.revenues,
    "op-costs": queryKeys.charts.opCosts,
} as const;

/** Fetches ranges concurrently. */
function useFetchChartGaps({
    chartType,
    resolution,
    rangesToFetch,
}: {
    chartType: ChartType;
    resolution: Resolution;
    rangesToFetch: TickRange[];
}) {
    const resolutionKey = toStringResolution(resolution);
    const queries = useQueries({
        queries: rangesToFetch.map((range) => {
            const queryKeyFn = QUERY_KEY_FN_BY_CHART_TYPE[chartType];

            return {
                queryKey: queryKeyFn(
                    resolutionKey,
                    range.startTick,
                    range.count,
                ),
                queryFn: () =>
                    chartsApi.getChartData({
                        chartType,
                        resolution,
                        range,
                    }),
                staleTime: 60 * 1000,
            };
        }),
    });

    const isLoading = queries.some((q) => q.isLoading);
    const isError = queries.some((q) => q.isError);

    return { isLoading, isError };
}

interface CachedTickRange {
    range: TickRange;
    data: ChartDataResponse;
}

interface ChartDataResponse {
    series: Record<string, number[]>;
}

/**
 * Calculates which tick ranges need to be fetched, analysing cached data
 * coverage. Returns minimal fetch requests to fill gaps.
 */

interface GetCacheGapsParams {
    queryClient: QueryClient;
    chartType: ChartType;
    resolution: Resolution;
    range: TickRange;
}

function getCacheGaps({
    queryClient,
    chartType,
    resolution,
    range,
}: GetCacheGapsParams): TickRange[] {
    // Find all cached ranges overlapping with desired range [start, end)
    const cachedRanges = getCachedChartRanges({
        queryClient,
        chartType,
        resolution,
        range,
    });

    // If no cache, fetch entire desired range
    if (cachedRanges.length === 0) {
        return [range];
    }

    // Otherwise, identify gaps between cached ranges
    const rangesToFetch: TickRange[] = [];
    let currentTick = range.startTick;

    for (const cached of cachedRanges) {
        // Accumulate if there is a gap with previous cached range
        if (currentTick < cached.range.startTick) {
            rangesToFetch.push({
                startTick: currentTick,
                count: (cached.range.startTick - currentTick) / resolution,
            });
        }
        // Advance past this cached range
        currentTick = cached.range.startTick + cached.range.count * resolution;
    }

    // Add a final requested range if the last cached range is strictly inside the requested range
    const desiredEndTick = range.startTick + range.count * resolution;
    if (currentTick < desiredEndTick) {
        rangesToFetch.push({
            startTick: currentTick,
            count: (desiredEndTick - currentTick) / resolution,
        });
    }

    // Return array of gap ranges to fetch
    return rangesToFetch;
}

/**
 * Extracts tick ranges from all successfully cached queries for a chart type
 * and resolution. Returns ranges sorted by startTick.
 *
 * @returns Array of cached ranges, sorted by startTick ascending
 */
export function getCachedChartRanges({
    queryClient,
    chartType,
    resolution,
    range,
}: {
    queryClient: QueryClient;
    chartType: ChartType;
    resolution: Resolution;
    range: TickRange;
}): CachedTickRange[] {
    const cache = queryClient.getQueryCache();
    const filters = {
        queryKey: ["charts", chartType, toStringResolution(resolution)],
        predicate: (query: Query) =>
            query.state.status === "success" && !!query.state.data,
    };
    const queries = cache.findAll(filters);

    const endTick = range.startTick + range.count * resolution;
    const ranges: CachedTickRange[] = queries
        .map((query) => {
            const queryKey = query.queryKey as [
                string,
                string,
                string,
                number,
                number,
            ];
            const [, , , startTick, count] = queryKey;
            return {
                range: {
                    startTick: startTick,
                    count: count,
                },
                data: query.state.data,
            } as CachedTickRange;
        })
        .filter((cache) => {
            const cachedRangeEndTick =
                cache.range.startTick + cache.range.count * resolution;
            // Range overlaps if: range.end > desired.start AND range.start < desired.end
            return (
                cachedRangeEndTick > range.startTick &&
                cache.range.startTick < endTick
            );
        })
        .sort((a, b) => a.range.startTick - b.range.startTick);

    return ranges;
}
