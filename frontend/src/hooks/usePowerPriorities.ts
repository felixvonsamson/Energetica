/** React Query hooks for power priorities data. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTickQuery } from "@/contexts/GameTickContext";
import { electricityMarketsApi } from "@/lib/api/electricity-markets";
import { powerPrioritiesApi } from "@/lib/api/power-priorities";
import { queryKeys } from "@/lib/query-client";

/**
 * Hook to fetch power priorities for the current player. Priorities change
 * every tick (facility output/consumption updates).
 */
export function usePowerPriorities() {
    // Register for tick-based invalidation since priorities show real-time data
    useTickQuery(queryKeys.powerPriorities.all);

    return useQuery({
        queryKey: queryKeys.powerPriorities.all,
        queryFn: powerPrioritiesApi.getAll,
        staleTime: 60 * 1000, // 1 minute
    });
}

/**
 * Hook to update power priorities order (drag mode). Used when player is NOT in
 * a network or using drag handles.
 */
export function useUpdatePowerPriorities() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: powerPrioritiesApi.update,
        onSuccess: () => {
            // Invalidate power priorities and facilities (priorities affect production)
            queryClient.invalidateQueries({
                queryKey: queryKeys.powerPriorities.all,
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.facilities.all,
            });
        },
    });
}

/**
 * Hook to update electricity market prices (price mode). Used when player IS in
 * a network and using price inputs.
 */
export function useUpdateElectricityPrices() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: electricityMarketsApi.changePrices,
        onSuccess: () => {
            // Invalidate electricity markets, power priorities, and facilities
            queryClient.invalidateQueries({
                queryKey: queryKeys.electricityMarkets.all,
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.powerPriorities.all,
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.facilities.all,
            });
        },
    });
}
