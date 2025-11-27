/**
 * Charts data fetching and aggregation hooks.
 *
 * Provides intelligent caching and data aggregation for time-series chart data.
 * Coordinates between multiple cached query ranges to minimize API calls while
 * ensuring complete coverage of the requested time range.
 *
 * Key Concepts:
 * - count: Number of datapoints (not ticks). Ticks covered = count × resolution.
 * - Tick ranges are [start_tick, start_tick + count × resolution) - exclusive end.
 * - Each datapoint at resolution N represents aggregated data over N ticks.
 * - Smart fetching fills gaps in cache coverage with minimal requests.
 */

import { useMemo } from "react";
import {
    Query,
    QueryClient,
    useQueries,
    useQueryClient,
} from "@tanstack/react-query";
import { chartsApi } from "@/lib/charts-api";
import { queryKeys } from "@/lib/query-client";
import { Resolution, toStringResolution } from "../types/charts";

interface ChartParams {
    resolution: Resolution;
    start_tick: number;
    count: number; // Number of datapoints (ticks covered = count × resolution)
}

/**
 * Aggregates power sources data from multiple cached query ranges.
 *
 * Combines data from overlapping cache entries to construct a complete time series
 * for the requested range. Automatically triggers fetches for missing data ranges.
 *
 * Process:
 * 1. Calculate desired tick range [start_tick, end_tick)
 * 2. Find all cached ranges that overlap with desired range
 * 3. For each overlapping region, extract data and map to tick values
 * 4. Return combined data sorted by tick
 *
 * @returns Aggregated data with loading/error states, or null if params undefined
 */
export function useAggregatedPowerSourcesChart(
    params: ChartParams | undefined,
) {
    const queryClient = useQueryClient();

    // Early return if params not ready (e.g., tick still loading)
    if (!params) {
        return {
            data: null,
            isLoading: false,
            isError: false,
        };
    }

    const { isLoading, isError } = useSmartPowerSourcesChart(params);

    const aggregatedData = useMemo(() => {
        // Calculate the exclusive end tick of the desired range
        const desiredEndTick =
            params.start_tick + params.count * params.resolution;

        // Map of tick -> {source1: value, source2: value, ...}
        const tickMap = new Map<number, Record<string, number>>();

        // Find cached ranges that overlap with [params.start_tick, desiredEndTick)
        const cachedRanges = _getCachedTickRanges(
            queryClient,
            "power-sources",
            params.resolution,
        ).filter((range) => {
            const rangeEndTick =
                range.start_tick + range.count * params.resolution;
            // Range overlaps if: range.end > desired.start AND range.start < desired.end
            return (
                rangeEndTick > params.start_tick &&
                range.start_tick < desiredEndTick
            );
        });

        // Aggregate data from all overlapping cached ranges
        for (const range of cachedRanges) {
            const queryKey = queryKeys.charts.powerSources(
                String(params.resolution),
                range.start_tick,
                range.count,
            );
            const cachedQuery = queryClient
                .getQueryCache()
                .find({ queryKey, exact: true });

            if (!cachedQuery || cachedQuery.state.status !== "success") {
                continue;
            }

            const data = cachedQuery.state.data as any;
            const rangeEndTick =
                range.start_tick + range.count * params.resolution;

            // Calculate the overlapping tick range [overlapStart, overlapEnd)
            const rawOverlapStart = Math.max(
                range.start_tick,
                params.start_tick,
            );
            const overlapEnd = Math.min(rangeEndTick, desiredEndTick);

            // CRITICAL: Ensure overlapStart is aligned to resolution
            // If misaligned, we'd access wrong indices in the data array
            // Example: if range starts at 100 with resolution 6, valid ticks are: 100, 106, 112, ...
            // If rawOverlapStart=103, we must round to 106 to stay aligned
            const overlapStart =
                Math.ceil(rawOverlapStart / params.resolution) *
                params.resolution;

            // Iterate through ticks in the overlap, stepping by resolution
            // Each tick represents the start of an interval [tick, tick + resolution)
            for (
                let tick = overlapStart;
                tick < overlapEnd;
                tick += params.resolution
            ) {
                // Calculate index into this range's data array
                // Example: if range starts at tick 100, resolution 6, and current tick is 112:
                //   localIndex = (112 - 100) / 6 = 2 (accesses datapoint[2])
                const localIndex =
                    (tick - range.start_tick) / params.resolution;

                if (!tickMap.has(tick)) {
                    tickMap.set(tick, {});
                }

                const tickData = tickMap.get(tick)!;

                // Copy all power source values for this tick
                Object.entries(data.series).forEach(
                    ([source, values]: [string, any]) => {
                        tickData[source] = values[localIndex] ?? 0;
                    },
                );
            }
        }

        const result = Array.from(tickMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([tick, sources]) => ({
                tick,
                ...sources,
            }));

        return result.length > 0 ? result : null;
    }, [
        queryClient,
        params?.resolution,
        params?.start_tick,
        params?.count,
        isLoading,
    ]);

    return {
        data: aggregatedData,
        isLoading,
        isError,
    };
}

/**
 * Intelligently fetches power sources data, only requesting uncached ranges.
 *
 * Analyzes the query cache to determine which tick ranges are missing and
 * issues minimal fetch requests to fill gaps.
 */
function useSmartPowerSourcesChart(params: ChartParams) {
    const queryClient = useQueryClient();

    const fetchResult = _getSmartFetchRange(
        queryClient,
        "power-sources",
        params.resolution,
        params.start_tick,
        params.count,
    );

    const queries = useQueries({
        queries: fetchResult.rangesToFetch.map((range) => ({
            queryKey: queryKeys.charts.powerSources(
                String(params.resolution),
                range.start_tick,
                range.count,
            ),
            queryFn: () =>
                chartsApi.getPowerSources({
                    resolution: params.resolution,
                    start_tick: range.start_tick,
                    count: range.count,
                }),
            staleTime: 60 * 1000,
        })),
    });

    const isLoading = queries.some((q) => q.isLoading);
    const isError = queries.some((q) => q.isError);

    return { isLoading, isError };
}

interface TickRange {
    start_tick: number; // Aligned to resolution
    count: number; // Number of datapoints (not ticks)
}

interface SmartFetchResult {
    rangesToFetch: TickRange[]; // Gaps that need to be fetched
    cachedRanges: TickRange[]; // Already cached ranges that overlap with request
}

function _getSuccessfulCachedQueries(
    queryClient: QueryClient,
    chartType: "power-sources",
    resolution: Resolution,
): Query[] {
    const cache = queryClient.getQueryCache();

    const filters = {
        queryKey: ["charts", "power-sources", toStringResolution(resolution)],
        predicate: (query: Query) =>
            query.state.status === "success" && !!query.state.data,
    };
    return cache.findAll(filters);
}

/**
 * Extracts tick ranges from all successfully cached queries for a chart type.
 *
 * Scans the query cache for matching chart queries and returns their tick ranges,
 * sorted by start_tick.
 *
 * @returns Array of cached ranges, sorted by start_tick ascending
 */
export function _getCachedTickRanges(
    queryClient: QueryClient,
    chartType: "power-sources",
    resolution: Resolution,
): TickRange[] {
    const relevantQueries = _getSuccessfulCachedQueries(
        queryClient,
        chartType,
        resolution,
    );

    const ranges: TickRange[] = relevantQueries
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
                count: count,
            };
        })
        .sort((a, b) => a.start_tick - b.start_tick);

    return ranges;
}

/**
 * Calculates which tick ranges need to be fetched to satisfy a request.
 *
 * Analyzes cached data coverage and returns minimal fetch requests to fill gaps.
 * Ensures all returned ranges have aligned start_tick values.
 *
 * Algorithm:
 * 1. Find all cached ranges overlapping with desired range [start, end)
 * 2. If no cache, fetch entire desired range
 * 3. Otherwise, identify gaps between cached ranges
 * 4. Return array of gap ranges to fetch
 *
 * @param desiredCount Number of datapoints (ticks covered = count × resolution)
 * @returns Ranges to fetch and ranges already cached
 */
function _getSmartFetchRange(
    queryClient: QueryClient,
    chartType: "power-sources",
    resolution: Resolution,
    desiredStartTick: number,
    desiredCount: number,
): SmartFetchResult {
    const allCachedRanges = _getCachedTickRanges(
        queryClient,
        chartType,
        resolution,
    );
    const desiredEndTick = desiredStartTick + desiredCount * resolution;

    const cachedRanges = allCachedRanges.filter((range) => {
        const rangeEndTick = range.start_tick + range.count * resolution;
        return (
            rangeEndTick > desiredStartTick && range.start_tick < desiredEndTick
        );
    });

    if (cachedRanges.length === 0) {
        return {
            rangesToFetch: [
                { start_tick: desiredStartTick, count: desiredCount },
            ],
            cachedRanges: [],
        };
    }

    // Identify gaps between cached ranges
    const rangesToFetch: TickRange[] = [];
    let currentTick = desiredStartTick;

    for (const cachedRange of cachedRanges) {
        // Gap before this cached range?
        if (currentTick < cachedRange.start_tick) {
            rangesToFetch.push({
                start_tick: currentTick,
                count: (cachedRange.start_tick - currentTick) / resolution,
            });
        }
        // Advance past this cached range
        currentTick = cachedRange.start_tick + cachedRange.count * resolution;
    }

    // Gap after all cached ranges?
    if (currentTick < desiredEndTick) {
        rangesToFetch.push({
            start_tick: currentTick,
            count: (desiredEndTick - currentTick) / resolution,
        });
    }

    return {
        rangesToFetch,
        cachedRanges,
    };
}
