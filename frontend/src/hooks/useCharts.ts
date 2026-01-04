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

import { useGameTick } from "@/hooks/useGameTick";
import { chartsApi } from "@/lib/api/charts";
import {
    POWER_GENERATION_KEYS,
    POWER_CONSUMPTION_KEYS,
    STORAGE_LEVEL_KEYS,
    REVENUES_KEYS,
    OP_COSTS_KEYS,
    EMISSIONS_KEYS,
    CLIMATE_KEYS,
    TEMPERATURE_KEYS,
    RESOURCES_KEYS,
    NETWORK_DATA_KEYS,
    NETWORK_EXPORTS_KEYS,
    NETWORK_IMPORTS_KEYS,
    NETWORK_GENERATION_KEYS,
    NETWORK_CONSUMPTION_KEYS,
    reorderObjectKeys,
} from "@/lib/charts/chart-key-order";
import { queryKeys } from "@/lib/query-client";

/** Map chart types to their corresponding key ordering */
const KEY_ORDER_BY_CHART_TYPE: Record<ChartType, readonly string[]> = {
    "power-sources": POWER_GENERATION_KEYS,
    "power-sinks": POWER_CONSUMPTION_KEYS,
    "storage-level": STORAGE_LEVEL_KEYS,
    revenues: REVENUES_KEYS,
    "op-costs": OP_COSTS_KEYS,
    emissions: EMISSIONS_KEYS,
    climate: CLIMATE_KEYS,
    temperature: TEMPERATURE_KEYS,
    resources: RESOURCES_KEYS,
    "network-data": NETWORK_DATA_KEYS,
    "network-exports": NETWORK_EXPORTS_KEYS,
    "network-imports": NETWORK_IMPORTS_KEYS,
    "network-generation": NETWORK_GENERATION_KEYS,
    "network-consumption": NETWORK_CONSUMPTION_KEYS,
};

/** Main exported hook. Returns all chart datapoints relevant to the request. */
export function useCurrentChartData({
    chartType,
    currentTick,
    resolution,
    maxDatapoints,
    networkId,
}: {
    chartType: ChartType;
    currentTick: number | undefined;
    resolution: Resolution;
    maxDatapoints: number;
    networkId?: number;
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
    } = useChartData({ chartType, range, resolution, networkId });

    // Return empty state if currentTick is not loaded
    if (!currentTick) {
        return { chartData: [], isLoading: true, isError: false };
    }

    return { chartData, isLoading, isError };
}

/**
 * Hook that provides the latest snapshot of chart data without UI jitter.
 *
 * Always fetches data at resolution 1 for the current tick. While that data is
 * loading, returns the previous tick's cached data (if available) instead of
 * showing empty states, preventing UI flicker during tick transitions.
 *
 * @returns Object with power levels by source/sink (e.g., {coal: 100, wind:
 *   50})
 */
export function useLatestChartData({
    chartType,
    networkId,
}: {
    chartType: ChartType;
    networkId?: number;
}): {
    data: Record<string, number>;
    isLoading: boolean;
    isError: boolean;
} {
    const { currentTick } = useGameTick();
    const queryClient = useQueryClient();

    const resolution = 1;
    const maxDatapoints = 1;

    // Attempt to fetch data for the current tick
    const {
        chartData: currentData,
        isLoading: currentIsLoading,
        isError,
    } = useCurrentChartData({
        chartType,
        currentTick,
        resolution,
        maxDatapoints,
        networkId,
    });

    // If current data is loading, try to get cached data from previous tick
    const cachedFallbackData = useMemo(() => {
        // Only attempt fallback if:
        // 1. Current data is still loading
        // 2. We have a valid current tick
        if (!currentIsLoading || !currentTick) {
            return null;
        }

        // Calculate range for the previous tick
        const previousTick = currentTick - 1;
        if (previousTick < 0) {
            return null; // No previous tick exists
        }

        const startTick =
            resolution *
            Math.max(0, Math.floor(previousTick / resolution - maxDatapoints));
        const count = Math.floor((previousTick - startTick) / resolution);

        if (count === 0) {
            return null; // No data points in range
        }

        const previousRange = { startTick, count };

        // Check if we have cached data for the previous tick
        const cachedRanges = getCachedChartRanges({
            queryClient,
            chartType,
            resolution,
            range: previousRange,
            networkId,
        });

        if (cachedRanges.length === 0) {
            return null; // No cached data available
        }

        // Aggregate cached data (same logic as useChartData)
        return aggregateChartData({
            cachedRanges,
            range: previousRange,
            resolution,
            chartType,
        });
    }, [currentIsLoading, currentTick, queryClient, chartType, networkId]);

    // Determine what data to return
    let chartData = currentData;
    let isLoading = currentIsLoading;

    if (
        currentIsLoading &&
        cachedFallbackData &&
        cachedFallbackData.length > 0
    ) {
        // We're loading new data but have cached fallback - use it
        chartData = cachedFallbackData;
        isLoading = false; // Don't show loading state since we have data
    }

    // Extract the last datapoint (or return empty object)
    if (chartData.length === 0) {
        return { data: {}, isLoading, isError };
    }

    const lastDatapoint = chartData[chartData.length - 1];

    // Remove the 'tick' property to return just the data values
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tick, ...data } = lastDatapoint;

    return { data, isLoading, isError };
}

/**
 * Helper function to aggregate chart data from cached ranges. Extracted for
 * reuse in both useChartData and useLatestChartData.
 */
function aggregateChartData({
    cachedRanges,
    range,
    resolution,
    chartType,
}: {
    cachedRanges: CachedTickRange[];
    range: TickRange;
    resolution: Resolution;
    chartType: ChartType;
}) {
    // Calculate the exclusive end tick of the desired range
    const endTick = range.startTick + range.count * resolution;

    // Map of tick -> {source1: value, source2: value, ...}
    const tickMap = new Map<number, Record<string, number>>();

    // Aggregate data from all overlapping cached ranges
    for (const cached of cachedRanges) {
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

    return result;
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
    networkId,
}: {
    chartType: ChartType;
    resolution: Resolution;
    range: TickRange;
    networkId?: number;
}) {
    const queryClient = useQueryClient();

    const rangesToFetch = getCacheGaps({
        queryClient,
        chartType,
        resolution,
        range,
        networkId,
    });

    const allCachedRanges = getCachedChartRanges({
        queryClient,
        chartType,
        resolution,
        range,
        networkId,
    });

    const { isLoading, isError } = useFetchChartGaps({
        chartType,
        resolution,
        rangesToFetch,
        networkId,
    });

    const aggregatedData = useMemo(() => {
        return aggregateChartData({
            cachedRanges: allCachedRanges,
            range,
            resolution,
            chartType,
        });
    }, [allCachedRanges, chartType, range, resolution]);

    return {
        data: isLoading ? [] : aggregatedData,
        isLoading,
        isError,
    };
}

/** Query key function type for regular charts */
type RegularChartQueryKeyFn = (
    resolution: string,
    startTick: number,
    count: number,
) => readonly unknown[];

/** Query key function type for network charts */
type NetworkChartQueryKeyFn = (
    networkId: number,
    resolution: string,
    startTick: number,
    count: number,
) => readonly unknown[];

/** Map chart types to their corresponding query key functions */
const QUERY_KEY_FN_BY_CHART_TYPE = {
    "power-sources": queryKeys.charts.powerSources,
    "power-sinks": queryKeys.charts.powerSinks,
    "storage-level": queryKeys.charts.storageLevel,
    revenues: queryKeys.charts.revenues,
    "op-costs": queryKeys.charts.opCosts,
    emissions: queryKeys.charts.emissions,
    climate: queryKeys.charts.climate,
    temperature: queryKeys.charts.temperature,
    resources: queryKeys.charts.resources,
    "network-data": queryKeys.charts.networkData,
    "network-exports": queryKeys.charts.networkExports,
    "network-imports": queryKeys.charts.networkImports,
    "network-generation": queryKeys.charts.networkGeneration,
    "network-consumption": queryKeys.charts.networkConsumption,
} as const;

const NETWORK_CHART_TYPES: ChartType[] = [
    "network-data",
    "network-exports",
    "network-imports",
    "network-generation",
    "network-consumption",
];

/** Fetches ranges concurrently. */
function useFetchChartGaps({
    chartType,
    resolution,
    rangesToFetch,
    networkId,
}: {
    chartType: ChartType;
    resolution: Resolution;
    rangesToFetch: TickRange[];
    networkId?: number;
}) {
    const resolutionKey = toStringResolution(resolution);
    const isNetworkChart = NETWORK_CHART_TYPES.includes(chartType);

    const queries = useQueries({
        queries: rangesToFetch.map((range) => {
            const queryKeyFn = QUERY_KEY_FN_BY_CHART_TYPE[chartType];

            if (isNetworkChart && networkId !== undefined) {
                // Network chart - pass networkId as first parameter
                return {
                    queryKey: (queryKeyFn as NetworkChartQueryKeyFn)(
                        networkId,
                        resolutionKey,
                        range.startTick,
                        range.count,
                    ),
                    queryFn: () =>
                        chartsApi.getNetworkChartData({
                            networkId,
                            chartType: chartType as
                                | "network-data"
                                | "network-exports"
                                | "network-imports"
                                | "network-generation"
                                | "network-consumption",
                            resolution,
                            range,
                        }),
                    staleTime: 60 * 1000,
                };
            } else {
                // Regular chart
                return {
                    queryKey: (queryKeyFn as RegularChartQueryKeyFn)(
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
            }
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
    networkId?: number;
}

function getCacheGaps({
    queryClient,
    chartType,
    resolution,
    range,
    networkId,
}: GetCacheGapsParams): TickRange[] {
    // Find all cached ranges overlapping with desired range [start, end)
    const cachedRanges = getCachedChartRanges({
        queryClient,
        chartType,
        resolution,
        range,
        networkId,
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
    networkId,
}: {
    queryClient: QueryClient;
    chartType: ChartType;
    resolution: Resolution;
    range: TickRange;
    networkId?: number;
}): CachedTickRange[] {
    const cache = queryClient.getQueryCache();
    const isNetworkChart = NETWORK_CHART_TYPES.includes(chartType);

    // Build query key filter based on chart type
    const queryKeyPrefix =
        isNetworkChart && networkId !== undefined
            ? ["charts", chartType, networkId, toStringResolution(resolution)]
            : ["charts", chartType, toStringResolution(resolution)];

    const filters = {
        queryKey: queryKeyPrefix,
        predicate: (query: Query) =>
            query.state.status === "success" && !!query.state.data,
    };
    const queries = cache.findAll(filters);

    const endTick = range.startTick + range.count * resolution;
    const ranges: CachedTickRange[] = queries
        .map((query) => {
            if (isNetworkChart && networkId !== undefined) {
                // Network chart query key: ["charts", chartType, networkId, resolution, startTick, count]
                const queryKey = query.queryKey as [
                    string,
                    string,
                    number,
                    string,
                    number,
                    number,
                ];
                const [, , , , startTick, count] = queryKey;
                return {
                    range: {
                        startTick: startTick,
                        count: count,
                    },
                    data: query.state.data,
                } as CachedTickRange;
            } else {
                // Regular chart query key: ["charts", chartType, resolution, startTick, count]
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
            }
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
