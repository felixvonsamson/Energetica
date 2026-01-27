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
} from "@/lib/charts/chart-key-order";
import { queryKeys } from "@/lib/query-client";
import { ApiResponse } from "@/types/api-helpers";
import {
    ChartType,
    Resolution,
    TickRange,
    toStringResolution,
} from "@/types/charts";

/**
 * Internal helper that fetches chart data without fallback logic. Used as a
 * base for useCurrentChartData.
 */
function useCurrentChartDataBase<T extends ChartType>({
    chartType,
    currentTick,
    resolution,
    maxDatapoints,
    marketId,
    minTick,
}: {
    chartType: T;
    currentTick: number | undefined;
    resolution: Resolution;
    maxDatapoints: number;
    marketId?: number;
    minTick?: number;
}) {
    // Determine the corresponding tick range
    const range = useMemo(() => {
        if (!currentTick) {
            return { startTick: 0, count: 0 };
        }
        const effectiveMinTick = minTick ?? 0;
        const startTick =
            resolution *
            Math.max(
                Math.floor(effectiveMinTick / resolution),
                Math.floor(currentTick / resolution - maxDatapoints),
            );
        const count = Math.floor((currentTick - startTick) / resolution);
        return { startTick, count };
    }, [currentTick, resolution, maxDatapoints, minTick]);

    // Call helper hook (always called, handles empty range gracefully)
    const {
        data: chartData,
        isLoading,
        isError,
    } = useChartData({ chartType, range, resolution, marketId });

    // Return empty state if currentTick is not loaded
    if (!currentTick) {
        return { chartData: [], isLoading: true, isError: false };
    }

    return { chartData, isLoading, isError };
}

/**
 * Main exported hook. Returns all chart datapoints relevant to the request.
 *
 * Includes jitter prevention: while loading new data for the current tick,
 * displays cached data from the previous range (if available) to prevent empty
 * states and UI flicker during tick transitions.
 */
export function useCurrentChartData<T extends ChartType>({
    chartType,
    currentTick,
    resolution,
    maxDatapoints,
    marketId,
    minTick,
}: {
    chartType: T;
    currentTick: number | undefined;
    resolution: Resolution;
    maxDatapoints: number;
    marketId?: number;
    minTick?: number;
}): {
    chartData: ChartDataPoint<T>[];
    isLoading: boolean;
    isError: boolean;
} {
    const queryClient = useQueryClient();

    // Fetch data for current tick range
    const {
        chartData: currentData,
        isLoading: currentIsLoading,
        isError,
    } = useCurrentChartDataBase({
        chartType,
        currentTick,
        resolution,
        maxDatapoints,
        marketId,
        minTick,
    });

    // If current data is loading, try to get cached data from previous range
    const cachedFallbackData = useMemo(() => {
        // Only attempt fallback if:
        // 1. Current data is still loading
        // 2. We have a valid current tick
        if (!currentIsLoading || !currentTick) {
            return null;
        }

        // Calculate range for the previous tick
        const previousTick = currentTick - resolution;
        const effectiveMinTick = minTick ?? 0;
        if (previousTick < effectiveMinTick) {
            return null; // No previous tick exists
        }

        const startTick =
            resolution *
            Math.max(
                Math.floor(effectiveMinTick / resolution),
                Math.floor(previousTick / resolution - maxDatapoints),
            );
        const count = Math.floor((previousTick - startTick) / resolution);

        if (count === 0) {
            return null; // No data points in range
        }

        const previousRange = { startTick, count };

        // Check if we have cached data for the previous range
        const cachedRanges = getCachedChartRanges({
            queryClient,
            chartType,
            resolution,
            range: previousRange,
            marketId,
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
    }, [
        currentIsLoading,
        currentTick,
        resolution,
        maxDatapoints,
        queryClient,
        chartType,
        marketId,
        minTick,
    ]);

    // Determine what data to return
    if (
        currentIsLoading &&
        cachedFallbackData &&
        cachedFallbackData.length > 0
    ) {
        // We're loading new data but have cached fallback - use it
        return {
            chartData: cachedFallbackData as ChartDataPoint<T>[],
            isLoading: false, // Don't show loading state since we have data
            isError,
        };
    }

    return {
        chartData: currentData as ChartDataPoint<T>[],
        isLoading: currentIsLoading,
        isError,
    };
}

/**
 * Hook that provides the latest snapshot of chart data without UI jitter.
 *
 * Always fetches data at resolution 1 for the current tick. Leverages
 * useCurrentChartData's fallback mechanism to show previous tick's data while
 * loading, preventing UI flicker during tick transitions.
 *
 * @returns Object with power levels by source/sink (e.g., {coal: 100, wind:
 *   50})
 */
export function useLatestChartData<T extends ChartType>({
    chartType,
    marketId,
    minTick,
}: {
    chartType: T;
    marketId?: number;
    minTick?: number;
}): {
    data: Partial<Record<string, number>>;
    isLoading: boolean;
    isError: boolean;
} {
    const { currentTick } = useGameTick();

    const resolution = 1;
    const maxDatapoints = 1;

    // Fetch data for the current tick (with fallback handled internally)
    const { chartData, isLoading, isError } = useCurrentChartData({
        chartType,
        currentTick,
        resolution,
        maxDatapoints,
        marketId,
        minTick,
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

/**
 * Helper function to aggregate chart data from cached ranges. Extracted for
 * reuse in both useChartData and useLatestChartData.
 */
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
 * for the requested range. Triggers fetches for missing data ranges and waits.
 */
function useChartData<T extends ChartType>({
    chartType,
    resolution,
    range,
    marketId,
}: {
    chartType: T;
    resolution: Resolution;
    range: TickRange;
    marketId?: number;
}): {
    data: ChartDataPoint<T>[];
    isLoading: boolean;
    isError: boolean;
} {
    const queryClient = useQueryClient();

    const rangesToFetch = getCacheGaps({
        queryClient,
        chartType,
        resolution,
        range,
        marketId,
    });

    const allCachedRanges = getCachedChartRanges({
        queryClient,
        chartType,
        resolution,
        range,
        marketId,
    });

    const { isLoading, isError } = useFetchChartGaps({
        chartType,
        resolution,
        rangesToFetch,
        marketId,
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

/** Query key function type for market charts */
type MarketChartQueryKeyFn = (
    marketId: number,
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
    "market-clearing": queryKeys.charts.marketClearingData,
    "market-exports": queryKeys.charts.marketExports,
    "market-imports": queryKeys.charts.marketImports,
    "market-generation": queryKeys.charts.marketGeneration,
    "market-consumption": queryKeys.charts.marketConsumption,
} as const;

const MARKET_CHART_TYPES: ChartType[] = [
    "market-clearing",
    "market-exports",
    "market-imports",
    "market-generation",
    "market-consumption",
];

/** Extract the sub-type from a market chart type for query key construction */
function getMarketChartSubType(chartType: ChartType): string {
    const mapping = {
        "market-clearing": "clearing-data",
        "market-exports": "exports",
        "market-imports": "imports",
        "market-generation": "generation",
        "market-consumption": "consumption",
    } as const;
    return mapping[chartType as keyof typeof mapping] || chartType;
}

/**
 * Extracts tick range from a query key.
 * Both regular and market chart query keys end with [..., startTick, count].
 */
function extractRangeFromQueryKey(
    queryKey: readonly unknown[],
): TickRange | null {
    const len = queryKey.length;
    if (len < 2) return null;
    const count = queryKey[len - 1];
    const startTick = queryKey[len - 2];
    if (typeof startTick !== "number" || typeof count !== "number")
        return null;
    return { startTick, count };
}

/**
 * Builds the query key prefix for a chart type and resolution.
 * Market charts: ["charts", "markets", marketId, chartSubType, resolution]
 * Regular charts: ["charts", chartType, resolution]
 */
function buildChartQueryKeyPrefix(
    chartType: ChartType,
    resolution: Resolution,
    marketId?: number,
): unknown[] {
    const isMarketChart = MARKET_CHART_TYPES.includes(chartType);

    if (isMarketChart && marketId !== undefined) {
        return [
            "charts",
            "markets",
            marketId,
            getMarketChartSubType(chartType),
            toStringResolution(resolution),
        ];
    }

    return ["charts", chartType, toStringResolution(resolution)];
}

/** Fetches ranges concurrently. */
function useFetchChartGaps({
    chartType,
    resolution,
    rangesToFetch,
    marketId,
}: {
    chartType: ChartType;
    resolution: Resolution;
    rangesToFetch: TickRange[];
    marketId?: number;
}) {
    const resolutionKey = toStringResolution(resolution);
    const isMarketChart = MARKET_CHART_TYPES.includes(chartType);

    const queries = useQueries({
        queries: rangesToFetch.map((range) => {
            const queryKeyFn = QUERY_KEY_FN_BY_CHART_TYPE[chartType];

            if (isMarketChart && marketId !== undefined) {
                // Market chart - pass marketId as first parameter
                return {
                    // chartType is encoded in queryKeyFn selection, resolution is passed as resolutionKey
                    // eslint-disable-next-line @tanstack/query/exhaustive-deps
                    queryKey: (queryKeyFn as MarketChartQueryKeyFn)(
                        marketId,
                        resolutionKey,
                        range.startTick,
                        range.count,
                    ),
                    queryFn: () =>
                        chartsApi.getMarketChartData({
                            marketId,
                            chartType: chartType as
                                | "market-clearing"
                                | "market-exports"
                                | "market-imports"
                                | "market-generation"
                                | "market-consumption",
                            resolution,
                            range,
                        }),
                    staleTime: 60 * 1000,
                };
            } else if (isMarketChart && marketId === undefined) {
                // Market chart without marketId - skip the query
                return {
                    queryKey: ["skip", chartType, resolutionKey],
                    queryFn: () => Promise.resolve({ series: {} }),
                    enabled: false,
                    staleTime: 60 * 1000,
                };
            } else {
                // Regular chart
                return {
                    // chartType is encoded in queryKeyFn selection, resolution is passed as resolutionKey
                    // eslint-disable-next-line @tanstack/query/exhaustive-deps
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
    marketId?: number;
}

function getCacheGaps({
    queryClient,
    chartType,
    resolution,
    range,
    marketId,
}: GetCacheGapsParams): TickRange[] {
    // Find all cached ranges overlapping with desired range [start, end)
    const cachedRanges = getCachedChartRanges({
        queryClient,
        chartType,
        resolution,
        range,
        marketId,
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
function getCachedChartRanges({
    queryClient,
    chartType,
    resolution,
    range,
    marketId,
}: {
    queryClient: QueryClient;
    chartType: ChartType;
    resolution: Resolution;
    range: TickRange;
    marketId?: number;
}): CachedTickRange[] {
    const cache = queryClient.getQueryCache();

    const queryKeyPrefix = buildChartQueryKeyPrefix(
        chartType,
        resolution,
        marketId,
    );

    const filters = {
        queryKey: queryKeyPrefix,
        predicate: (query: Query) =>
            query.state.status === "success" && !!query.state.data,
    };
    const queries = cache.findAll(filters);

    const endTick = range.startTick + range.count * resolution;
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
