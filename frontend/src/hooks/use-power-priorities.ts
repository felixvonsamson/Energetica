/** React Query hooks for power priorities data. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTickQuery } from "@/contexts/game-tick-context";
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

/** Hook to bump a single power priority item one step up or down. */
export function useUpdatePowerPriorityBump() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (vars: {
            side: string;
            type: string;
            direction: "increase" | "decrease";
        }) => powerPrioritiesApi.bump(vars),
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.powerPriorities.all,
            });
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
