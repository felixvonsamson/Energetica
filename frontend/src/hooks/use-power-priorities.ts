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
 * Hook to bump a single power priority item one step up or down. Applies an
 * optimistic cache update so the reorder is reflected immediately; on success
 * the authoritative server state is written directly into the cache; on error
 * the snapshot from onMutate is restored.
 */
export function useUpdatePowerPriorityBump() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (vars: {
            side: string;
            type: string;
            direction: "increase" | "decrease";
        }) => powerPrioritiesApi.bump(vars),
        onMutate: async ({ side, type, direction }) => {
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
                    const priorities = [...old.power_priorities];
                    const idx = priorities.findIndex(
                        (p) =>
                            p.side === side &&
                            (p.type as unknown as string) === type,
                    );
                    if (idx === -1) return old;
                    const neighbourIdx =
                        direction === "increase" ? idx - 1 : idx + 1;
                    if (neighbourIdx < 0 || neighbourIdx >= priorities.length) {
                        return old;
                    }
                    [priorities[idx], priorities[neighbourIdx]] = [
                        priorities[neighbourIdx]!,
                        priorities[idx]!,
                    ];
                    return { ...old, power_priorities: priorities };
                },
            );

            return { previousData };
        },
        onSuccess: (data) => {
            queryClient.setQueryData(queryKeys.powerPriorities.all, data);
        },
        onError: (_err, _vars, context) => {
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
