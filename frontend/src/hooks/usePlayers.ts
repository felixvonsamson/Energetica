/**
 * Hook for fetching all players.
 * Used for community features like chat participant lists and leaderboards.
 */

import { useQuery } from "@tanstack/react-query";
import { playerApi } from "@/lib/player-api";
import { queryKeys } from "@/lib/query-client";

export function usePlayers() {
    return useQuery({
        queryKey: queryKeys.players.all,
        queryFn: playerApi.getAll,
        // Player list updates infrequently (only when new players join)
        // Keep data fresh for 5 minutes
        staleTime: 5 * 60 * 1000,
        // Keep data in cache for 10 minutes
        gcTime: 10 * 60 * 1000,
        // Refetch on window focus to ensure data is current
        refetchOnWindowFocus: true,
    });
}
