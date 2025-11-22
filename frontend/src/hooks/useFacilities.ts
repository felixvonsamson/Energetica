/**
 * React Query hooks for facilities data.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { facilitiesApi } from "@/lib/facilities-api";
import { queryKeys } from "@/lib/query-client";
import { useTickQuery } from "@/contexts/GameTickContext";

/**
 * Hook to fetch all facilities for the current player.
 * Facilities change every tick (power output, state of charge, etc.)
 */
export function useFacilities() {
    // Register for tick-based invalidation since facilities show real-time data
    useTickQuery(queryKeys.facilities.all);

    return useQuery({
        queryKey: queryKeys.facilities.all,
        queryFn: facilitiesApi.getAll,
        staleTime: 60 * 1000, // 1 minute
    });
}

/**
 * Hook to upgrade a single facility.
 */
export function useUpgradeFacility() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: facilitiesApi.upgrade,
        onSuccess: () => {
            // Invalidate facilities and money queries after upgrade
            queryClient.invalidateQueries({ queryKey: queryKeys.facilities.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.players.money });
        },
    });
}

/**
 * Hook to upgrade all facilities of a type.
 */
export function useUpgradeAllOfType() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: facilitiesApi.upgradeAll,
        onSuccess: () => {
            // Invalidate facilities and money queries after mass upgrade
            queryClient.invalidateQueries({ queryKey: queryKeys.facilities.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.players.money });
        },
    });
}

/**
 * Hook to dismantle a single facility.
 */
export function useDismantleFacility() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: facilitiesApi.dismantle,
        onSuccess: () => {
            // Invalidate facilities and money queries after dismantle
            queryClient.invalidateQueries({ queryKey: queryKeys.facilities.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.players.money });
        },
    });
}

/**
 * Hook to dismantle all facilities of a type.
 */
export function useDismantleAllOfType() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: facilitiesApi.dismantleAll,
        onSuccess: () => {
            // Invalidate facilities and money queries after mass dismantle
            queryClient.invalidateQueries({ queryKey: queryKeys.facilities.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.players.money });
        },
    });
}
