/** React Query hooks for power priorities data. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTickQuery } from "@/contexts/game-tick-context";
import { electricityMarketsApi } from "@/lib/api/electricity-markets";
import { powerPrioritiesApi } from "@/lib/api/power-priorities";
import { queryKeys } from "@/lib/query-client";
import type { ApiResponse } from "@/types/api-helpers";

type PowerPrioritiesData = ApiResponse<"/api/v1/power-priorities", "get">;

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
 * Hook to update power priorities order. Applies an optimistic cache update
 * so the reorder is reflected immediately; rolls back on error. The server
 * sends socket.io invalidation to all clients on success.
 */
export function useUpdatePowerPriorities() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: powerPrioritiesApi.update,
        onMutate: async (newData) => {
            // Prevent in-flight refetches from overwriting the optimistic state.
            await queryClient.cancelQueries({
                queryKey: queryKeys.powerPriorities.all,
            });

            const previousData = queryClient.getQueryData<PowerPrioritiesData>(
                queryKeys.powerPriorities.all,
            );

            queryClient.setQueryData<PowerPrioritiesData>(
                queryKeys.powerPriorities.all,
                (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        power_priorities: newData.power_priorities,
                    };
                },
            );

            return { previousData };
        },
        onError: (_err, _newData, context) => {
            // Roll back to the snapshot taken before the optimistic update.
            if (context?.previousData !== undefined) {
                queryClient.setQueryData(
                    queryKeys.powerPriorities.all,
                    context.previousData,
                );
            }
        },
    });
}

/**
 * Hook to update electricity market prices. The server sends socket.io
 * invalidation to all clients on success.
 */
export function useUpdateElectricityPrices() {
    return useMutation({
        mutationFn: electricityMarketsApi.changePrices,
    });
}
