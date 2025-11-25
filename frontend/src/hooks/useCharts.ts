/**
 * React Query hooks for chart data.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { chartsApi } from "@/lib/charts-api";
import { queryKeys } from "@/lib/query-client";
import {
    getMostRecentCachedTick,
    getSmartFetchRange,
} from "@/lib/charts-cache-utils";

type Resolution = "1" | "6" | "36" | "216" | "1296";

interface ChartParams {
    resolution: Resolution;
    start_tick: number;
    count: number;
}

/**
 * Hook to fetch power sources chart data (generation and imports).
 */
export function usePowerSourcesChart(params: ChartParams) {
    return useQuery({
        queryKey: queryKeys.charts.powerSources(
            params.resolution,
            params.start_tick,
            params.count,
        ),
        queryFn: () => chartsApi.getPowerSources(params),
        staleTime: 60 * 1000, // 1 minute
    });
}

/**
 * Hook to fetch power sinks chart data (demand by category).
 */
export function usePowerSinksChart(params: ChartParams) {
    return useQuery({
        queryKey: queryKeys.charts.powerSinks(
            params.resolution,
            params.start_tick,
            params.count,
        ),
        queryFn: () => chartsApi.getPowerSinks(params),
        staleTime: 60 * 1000, // 1 minute
    });
}

/**
 * Hook to intelligently fetch power sources data, avoiding cached ranges.
 * Automatically determines the next range to fetch based on cache state.
 */
export function useSmartPowerSourcesChart(params: ChartParams) {
    const queryClient = useQueryClient();

    // Get the optimal range to fetch
    const fetchRange = getSmartFetchRange(
        queryClient,
        "powerSources",
        params.resolution,
        params.start_tick,
        params.count,
    );

    return useQuery({
        queryKey: queryKeys.charts.powerSources(
            params.resolution,
            fetchRange.start_tick,
            fetchRange.count,
        ),
        queryFn: () =>
            chartsApi.getPowerSources({
                resolution: params.resolution,
                start_tick: fetchRange.start_tick,
                count: fetchRange.count,
            }),
        staleTime: 60 * 1000,
        // Skip the query if data is already fully cached
        enabled: fetchRange.shouldFetch,
    });
}

/**
 * Hook to intelligently fetch power sinks data, avoiding cached ranges.
 * Automatically determines the next range to fetch based on cache state.
 */
export function useSmartPowerSinksChart(params: ChartParams) {
    const queryClient = useQueryClient();

    // Get the optimal range to fetch
    const fetchRange = getSmartFetchRange(
        queryClient,
        "powerSinks",
        params.resolution,
        params.start_tick,
        params.count,
    );

    return useQuery({
        queryKey: queryKeys.charts.powerSinks(
            params.resolution,
            fetchRange.start_tick,
            fetchRange.count,
        ),
        queryFn: () =>
            chartsApi.getPowerSinks({
                resolution: params.resolution,
                start_tick: fetchRange.start_tick,
                count: fetchRange.count,
            }),
        staleTime: 60 * 1000,
        // Skip the query if data is already fully cached
        enabled: fetchRange.shouldFetch,
    });
}

/**
 * Hook to get the most recent cached tick for power sources.
 * Useful for incrementally loading more historical data.
 */
export function useMostRecentPowerSourcesTick(resolution: Resolution) {
    const queryClient = useQueryClient();
    const tick = getMostRecentCachedTick(
        queryClient,
        "powerSources",
        resolution,
    );
    return tick;
}

/**
 * Hook to get the most recent cached tick for power sinks.
 * Useful for incrementally loading more historical data.
 */
export function useMostRecentPowerSinksTick(resolution: Resolution) {
    const queryClient = useQueryClient();
    const tick = getMostRecentCachedTick(queryClient, "powerSinks", resolution);
    return tick;
}
