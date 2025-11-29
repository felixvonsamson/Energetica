/**
 * Hook for fetching scoreboard data. Displays all players ranked by various
 * metrics.
 */

import { useQuery } from "@tanstack/react-query";
import { playerApi } from "@/lib/player-api";
import { queryKeys } from "@/lib/query-client";

export function useScoreboard() {
    return useQuery({
        queryKey: queryKeys.scoreboard.all,
        queryFn: playerApi.getScoreboard,
        // Scoreboard data updates infrequently (only when players progress)
        // Keep data fresh for 5 minutes
        staleTime: 5 * 60 * 1000,
        // Keep data in cache for 10 minutes
        gcTime: 10 * 60 * 1000,
        // Refetch on window focus to ensure data is current
        refetchOnWindowFocus: true,
    });
}
