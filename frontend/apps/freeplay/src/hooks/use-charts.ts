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

import { reorderObjectKeys } from "@energetica/charts/lib/key-order";
import { ApiClientError } from "@energetica/core/api-client";
import {
    hashKey,
    Query,
    QueryClient,
    useQueries,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useRef } from "react";

import { useGameTick } from "@/hooks/use-game-tick";
import { chartsApi } from "@/lib/api/charts";
import {
    ChartDataPoint,
    KEY_ORDER_BY_CHART_TYPE,
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
 *
 * While the tick may be behind the server, no data is requested and the hook
 * reports loading instead (see `planChartFetches`).
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
    const { currentTick, isTickFresh, reportStaleTick } = useGameTick();
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
    const { rangesToFetch, isWaitingForTick } = planChartFetches({
        queryClient,
        config,
        range,
        isTickFresh,
    });
    const { isLoading: isFetching, isError } = useFetchChartGaps({
        config,
        rangesToFetch,
        onStaleTickRejection: reportStaleTick,
    });
    const isLoading = isFetching || isWaitingForTick;

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

/**
 * Fetches ranges concurrently. Calls `onStaleTickRejection` when a rejection
 * suggests the range was built from a stale tick (see
 * `claimStaleTickRejection`).
 */
function useFetchChartGaps({
    config,
    rangesToFetch,
    onStaleTickRejection,
}: {
    config: ChartQueryConfig;
    rangesToFetch: TickRange[];
    onStaleTickRejection: () => void;
}) {
    const reportedRejections = useRef(new Set<string>());
    const queries = useQueries({
        queries: rangesToFetch.map((range) => {
            const queryKey = buildChartQueryKey(config, range);
            return {
                queryKey,
                queryFn: async () => {
                    try {
                        return await chartsApi.getChartData({
                            identifier: config,
                            resolution: config.resolution,
                            range,
                        });
                    } catch (error) {
                        const isStale = claimStaleTickRejection({
                            error,
                            queryKey,
                            reported: reportedRejections.current,
                        });
                        if (isStale) onStaleTickRejection();
                        throw error;
                    }
                },
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
 * Decides which chart ranges to request now.
 *
 * Ranges are built from the client's copy of the current tick. While that copy
 * may be behind the server (the socket dropped or the tab was frozen), a range
 * built from it can start before the oldest datapoint the server keeps, and the
 * server rejects it with 400. So nothing is requested until the tick is fresh,
 * and `isWaitingForTick` tells the caller to keep showing what it has.
 */
export function planChartFetches({
    queryClient,
    config,
    range,
    isTickFresh,
}: {
    queryClient: QueryClient;
    config: ChartQueryConfig;
    range: TickRange;
    isTickFresh: boolean;
}): {
    rangesToFetch: TickRange[];
    isWaitingForTick: boolean;
} {
    const gaps = getCacheGaps({ queryClient, config, range });
    if (!isTickFresh) {
        return { rangesToFetch: [], isWaitingForTick: gaps.length > 0 };
    }
    return { rangesToFetch: gaps, isWaitingForTick: false };
}

/**
 * Whether a failed chart request should be reported as a stale tick, recording
 * the range in `reported` if so.
 *
 * A 400 can mean the range was built from a tick that went stale in a way
 * nothing else noticed: a request sent just before the tab froze, or the server
 * moving past a datapoint boundary while the request was in flight. Re-reading
 * the tick fixes those. Each range is reported once: if it fails again after
 * the tick was re-read, the error is real, and reporting it again would loop.
 */
export function claimStaleTickRejection({
    error,
    queryKey,
    reported,
}: {
    error: unknown;
    queryKey: readonly unknown[];
    reported: Set<string>;
}): boolean {
    if (!(error instanceof ApiClientError) || error.status !== 400) {
        return false;
    }
    const hash = hashKey(queryKey);
    if (reported.has(hash)) return false;
    reported.add(hash);
    return true;
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
        // On the happy path this query always resolves with real order data and
        // Infinity is correct — historical ticks are immutable.
        //
        // Workaround: the backend returns an empty payload when the game engine
        // hasn't written the per-tick pickle file yet (race condition) or for
        // ticks predating market creation. Those responses must not be cached
        // forever, so we use a short staleTime to allow a retry after a brief
        // window rather than treating them as permanent.
        staleTime: (query) => {
            const data = query.state.data as
                | MarketOrdersDataResponse
                | undefined;
            if (!data || data.capacities.price.length === 0) {
                return 30_000;
            }
            return Infinity;
        },
    });

    // If data is loading, try to find the closest cached tick
    // Optimized: check specific nearby ticks instead of searching entire cache
    const cachedFallbackData = useMemo(() => {
        // Only use fallback if loading and don't have current data
        if (!query.isLoading) {
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
    }, [queryClient, marketId, tick, query.isLoading]);

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
