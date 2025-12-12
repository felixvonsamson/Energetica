/**
 * Hook for fetching and managing player money. Automatically syncs with game
 * ticks and can be manually invalidated.
 */

import { useQuery } from "@tanstack/react-query";

import { useTickQuery } from "@/contexts/GameTickContext";
import { playerApi } from "@/lib/api/player";
import { queryKeys } from "@/lib/query-client";

export function usePlayerMoney() {
    // Register this query to be refetched on each game tick
    useTickQuery(queryKeys.players.money);

    return useQuery({
        queryKey: queryKeys.players.money,
        queryFn: playerApi.getMoney,
        // Keep data fresh for the full tick duration (1 minute)
        // This prevents unnecessary refetches between ticks
        staleTime: 60 * 1000,
        // Keep data in cache for 5 minutes even if not being used
        gcTime: 5 * 60 * 1000,
        // Refetch on window focus to ensure data is current
        refetchOnWindowFocus: true,
    });
}
