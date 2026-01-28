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
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";

import { useGameTick } from "@/hooks/useGameTick";
import { chartsApi } from "@/lib/api/charts";
import {
    ChartDataPoint,
    KEY_ORDER_BY_CHART_TYPE,
    reorderObjectKeys,
} from "@/lib/charts/key-order";
import {
    ChartQueryConfig,
    ChartIdentifier,
    buildChartQueryKeyPrefix,
    extractRangeFromQueryKey,
    buildChartQueryKey,
} from "@/lib/charts/query-keys";
import { queryKeys } from "@/lib/query-client";
import { ApiResponse } from "@/types/api-helpers";
import { ChartType, Resolution, TickRange } from "@/types/charts";

/**
 * Main exported hook. Returns all chart datapoints relevant to the request.
 *
 * Includes jitter prevention: while loading new data for the current tick,
 * displays cached data from the previous range (if available) to prevent empty
 * states and UI flicker during tick transitions.
 */
export function useChartData<T extends ChartType>({
    config,
    maxDatapoints,
}: {
    config: ChartQueryConfig & { chartType: T };
    maxDatapoints: number;
}): {
    chartData: ChartDataPoint<T>[];
    isLoading: boolean;
    isError: boolean;
} {
    const queryClient = useQueryClient();
    const { currentTick } = useGameTick();
    const resolution = config.resolution;
    const range = computeRange({ currentTick, resolution, maxDatapoints });
    const rangeOld = computeRange({
        currentTick: currentTick ? currentTick - 1 : undefined,
        resolution,
        maxDatapoints,
    });

    // Call helper hook
    const { data } = useChartDataOnRange({
        config,
        range,
        chartType: config.chartType,
    });
    // as fallback, try to get cached data from previous range
    const { data: cachedFallbackData } = useChartDataOnRange({
        config,
        range: rangeOld,
        chartType: config.chartType,
    });

    // Also, trigger fetches
    const rangesToFetch = getCacheGaps({
        queryClient,
        config,
        range,
    });
    const { isLoading, isError } = useFetchChartGaps({
        config,
        rangesToFetch,
    });

    // Determine what data to return
    if (isLoading && cachedFallbackData.length > 0) {
        // We're loading new data but have cached fallback - use it
        return {
            chartData: cachedFallbackData,
            isLoading: false, // Don't show loading state since we have data
            isError,
        };
    }

    return {
        chartData: data,
        isLoading,
        isError,
    };
}

/** Calculate the tick range for a given current tick and resolution */
function computeRange({
    currentTick,
    resolution,
    maxDatapoints,
}: {
    currentTick: number | undefined;
    resolution: Resolution;
    maxDatapoints: number;
}): TickRange {
    if (!currentTick) {
        return { startTick: 0, count: 0 };
    }
    const startTick =
        resolution *
        Math.max(0, Math.floor(currentTick / resolution - maxDatapoints));
    const count = Math.floor((currentTick - startTick) / resolution);
    return { startTick, count };
}

/**
 * Hook that provides the latest snapshot of chart data without UI jitter.
 *
 * Always fetches data at resolution 1 for the current tick. Leverages
 * useChartData's fallback mechanism to show previous tick's data while loading,
 * preventing UI flicker during tick transitions.
 *
 * @returns Object with power levels by source/sink (e.g., {coal: 100, wind:
 *   50})
 */
export function useLatestChartDataSlice(chartIdentifier: ChartIdentifier): {
    data: Partial<Record<string, number>>;
    isLoading: boolean;
    isError: boolean;
} {
    const resolution = 1;
    const maxDatapoints = 1;

    // Fetch data for the current tick (with fallback handled internally)
    const { chartData, isLoading, isError } = useChartData({
        config: { ...chartIdentifier, resolution: resolution },
        maxDatapoints,
    });

    // Extract the last datapoint (or return empty object)
    if (chartData.length === 0) {
        return { data: {}, isLoading, isError };
    }

    const lastDatapoint = chartData[chartData.length - 1];
    if (!lastDatapoint) {
        return { data: {}, isLoading, isError };
    }

    // Remove the 'tick' property to return just the data values
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tick, ...data } = lastDatapoint;

    return { data, isLoading, isError };
}

/** Helper function to aggregate chart data from cached ranges. */
function aggregateChartData<T extends ChartType>({
    cachedRanges,
    range,
    resolution,
    chartType,
}: {
    cachedRanges: CachedTickRange[];
    range: TickRange;
    resolution: Resolution;
    chartType: T;
}): ChartDataPoint<T>[] {
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
            } as ChartDataPoint<T>;
        });

    return result;
}

/**
 * Aggregates chart data from multiple cached query ranges.
 *
 * Combines data from multiple cache entries to construct a complete time series
 * for the requested range.
 */
function useChartDataOnRange<T extends ChartType>({
    config,
    range,
    chartType,
}: {
    config: ChartQueryConfig;
    range: TickRange;
    chartType: T;
}): {
    data: ChartDataPoint<T>[];
} {
    const queryClient = useQueryClient();

    const allCachedRanges = getCachedChartRanges({
        queryClient,
        config,
        range,
    });

    const aggregatedData = useMemo(() => {
        return aggregateChartData({
            cachedRanges: allCachedRanges,
            range,
            resolution: config.resolution,
            chartType,
        });
    }, [allCachedRanges, chartType, range, config.resolution]);

    return {
        data: aggregatedData,
    };
}

/** Fetches ranges concurrently. */
function useFetchChartGaps({
    config,
    rangesToFetch,
}: {
    config: ChartQueryConfig;
    rangesToFetch: TickRange[];
}) {
    const queries = useQueries({
        queries: rangesToFetch.map((range) => {
            return {
                queryKey: buildChartQueryKey(config, range),
                queryFn: () =>
                    chartsApi.getChartData({
                        identifier: config,
                        resolution: config.resolution,
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
function getCacheGaps({
    queryClient,
    config,
    range,
}: {
    queryClient: QueryClient;
    config: ChartQueryConfig;
    range: TickRange;
}): TickRange[] {
    // Find all cached ranges overlapping with desired range [start, end)
    const cachedRanges = getCachedChartRanges({
        queryClient,
        config,
        range,
    });

    // If no cache, fetch entire desired range
    if (cachedRanges.length === 0) {
        return [range];
    }

    // Otherwise, identify gaps between cached ranges
    const rangesToFetch: TickRange[] = [];
    let tick = range.startTick;

    for (const cached of cachedRanges) {
        // Accumulate if there is a gap with previous cached range
        if (tick < cached.range.startTick) {
            rangesToFetch.push({
                startTick: tick,
                count: (cached.range.startTick - tick) / config.resolution,
            });
        }
        // Advance past this cached range
        tick = cached.range.startTick + cached.range.count * config.resolution;
    }

    // Add a final requested range if the last cached range is strictly inside the requested range
    const desiredEndTick = range.startTick + range.count * config.resolution;
    if (tick < desiredEndTick) {
        rangesToFetch.push({
            startTick: tick,
            count: (desiredEndTick - tick) / config.resolution,
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
function getCachedChartRanges({
    queryClient,
    config,
    range,
}: {
    queryClient: QueryClient;
    config: ChartQueryConfig;
    range: TickRange;
}): CachedTickRange[] {
    if (range.count === 0) return [];

    const cache = queryClient.getQueryCache();

    const queryKeyPrefix = buildChartQueryKeyPrefix(config);

    const filters = {
        queryKey: queryKeyPrefix,
        predicate: (query: Query) =>
            query.state.status === "success" && !!query.state.data,
    };
    const queries = cache.findAll(filters);

    const endTick = range.startTick + range.count * config.resolution;
    const ranges: CachedTickRange[] = queries
        .map((query) => {
            const tickRange = extractRangeFromQueryKey(query.queryKey);
            if (!tickRange) return null;

            return {
                range: tickRange,
                data: query.state.data,
            } as CachedTickRange;
        })
        .filter((cache): cache is CachedTickRange => cache !== null)
        .filter((cache) => {
            const cachedRangeEndTick =
                cache.range.startTick + cache.range.count * config.resolution;
            // Range overlaps if: range.end > desired.start AND range.start < desired.end
            return (
                cachedRangeEndTick > range.startTick &&
                cache.range.startTick < endTick
            );
        })
        .sort((a, b) => a.range.startTick - b.range.startTick);

    return ranges;
}

/** Market order data response type extracted from OpenAPI schema. */
type MarketOrdersDataResponse = ApiResponse<
    "/api/v1/charts/markets/{market_id}/market/{tick}",
    "get"
>;

/**
 * Hook to fetch market supply/demand curve data for a specific tick.
 *
 * This returns the complete market state including supply and demand curves,
 * player imports/exports, generation, consumption, and market clearing
 * price/quantity.
 *
 * Includes jitter prevention: while loading new data for the requested tick,
 * displays cached data from the closest available tick to prevent UI flicker
 * during slider transitions.
 *
 * @param marketId - ID of the market
 * @param tick - Specific tick to fetch market data for
 * @returns Market data including supply/demand curves and clearing
 *   price/quantity
 */
export function useMarketData({
    marketId,
    tick,
}: {
    marketId: number;
    tick: number;
}) {
    const queryClient = useQueryClient();

    // Fetch data for the requested tick
    // Explicitly type the query to avoid `{} | ActualType` union issues
    const query = useQuery<MarketOrdersDataResponse>({
        queryKey: queryKeys.charts.marketOrderData(marketId, tick),
        queryFn: () => chartsApi.getMarketData(marketId, tick),
        staleTime: Infinity, // Historical market data never changes
    });

    // If data is loading, try to find the closest cached tick
    // Optimized: check specific nearby ticks instead of searching entire cache
    const cachedFallbackData = useMemo(() => {
        // Only use fallback if loading and don't have current data
        if (!query.isLoading || query.data) {
            return null;
        }

        // Try nearby ticks in order of proximity (±1, ±2, ±3, etc.)
        // This is much faster than iterating through all cached queries
        const maxDistance = 20;
        for (let dist = 1; dist <= maxDistance; dist++) {
            // Try tick - dist first (recent past is more likely to be useful)
            const lowerTick = tick - dist;
            const lowerQuery =
                queryClient.getQueryData<MarketOrdersDataResponse>(
                    queryKeys.charts.marketOrderData(marketId, lowerTick),
                );
            if (lowerQuery) {
                return lowerQuery;
            }

            // Then try tick + dist
            const higherTick = tick + dist;
            const higherQuery =
                queryClient.getQueryData<MarketOrdersDataResponse>(
                    queryKeys.charts.marketOrderData(marketId, higherTick),
                );
            if (higherQuery) {
                return higherQuery;
            }
        }

        return null; // No cached data available nearby
    }, [queryClient, marketId, tick, query.isLoading, query.data]);

    // If loading and we have fallback data, return that instead
    if (query.isLoading && cachedFallbackData) {
        return {
            data: cachedFallbackData,
            isLoading: false, // Don't show loading state since we have data
            isError: query.isError,
            error: query.error,
            refetch: query.refetch,
        };
    }

    return query;
}
