/**
 * Hook for fetching player profile data. Includes functional facility levels,
 * technology levels, and progression metrics. This data is relatively static
 * and only changes when player levels up facilities/technologies.
 */

import { useQuery } from "@tanstack/react-query";
import { playerApi } from "@/lib/player-api";
import { queryKeys } from "@/lib/query-client";

export function usePlayerProfile() {
    return useQuery({
        queryKey: queryKeys.players.profile,
        queryFn: playerApi.getProfile,
        // Profile data changes infrequently (only on facility/tech upgrades)
        // Keep data fresh for 5 minutes
        staleTime: 5 * 60 * 1000,
        // Keep data in cache for 10 minutes
        gcTime: 10 * 60 * 1000,
        // Refetch on window focus to ensure data is current
        refetchOnWindowFocus: true,
    });
}
