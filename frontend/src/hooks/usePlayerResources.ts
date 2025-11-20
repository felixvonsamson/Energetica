/**
 * Hook for fetching and managing player resources.
 *
 * Uses tick-based refetching since resources change every tick based on:
 * - Power generation (consuming coal/gas/uranium)
 * - Extraction facilities (producing resources)
 * - User actions (buying/selling resources)
 */

import { useQuery } from "@tanstack/react-query";
import { playerApi } from "@/lib/player-api";
import { queryKeys } from "@/lib/query-client";
import { useTickQuery } from "@/contexts/GameTickContext";

export function usePlayerResources() {
    // Register for tick-based refetching (resources change with consumption/production)
    useTickQuery(queryKeys.players.resources);

    return useQuery({
        queryKey: queryKeys.players.resources,
        queryFn: playerApi.getResources,
        // Keep data fresh for the full tick duration (1 minute)
        staleTime: 60 * 1000,
        // Keep data in cache for 5 minutes
        gcTime: 5 * 60 * 1000,
        // Refetch on window focus
        refetchOnWindowFocus: true,
    });
}
