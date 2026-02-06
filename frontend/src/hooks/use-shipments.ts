/** Hooks for fetching incoming resource shipments. */

import { useQuery } from "@tanstack/react-query";

import { useTickQuery } from "@/contexts/game-tick-context";
import { shipmentsApi } from "@/lib/api/shipments";
import { queryKeys } from "@/lib/query-client";

/**
 * Get all ongoing incoming shipments. Updates every tick since shipments
 * progress over time.
 */
export function useShipments() {
    // Register for tick-based refetching (shipments progress each tick)
    useTickQuery(queryKeys.shipments.all);

    return useQuery({
        queryKey: queryKeys.shipments.all,
        queryFn: shipmentsApi.getShipments,
        // Keep data fresh for the full tick duration (1 minute)
        staleTime: 60 * 1000,
        // Keep data in cache for 5 minutes
        gcTime: 5 * 60 * 1000,
        // Refetch on window focus
        refetchOnWindowFocus: true,
    });
}
