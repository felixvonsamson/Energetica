/**
 * Hook for fetching leaderboards data. Displays all players ranked by various
 * metrics.
 */

import { useTickQuery } from "@/contexts/GameTickContext";
import { playerApi } from "@/lib/api/player";
import { queryKeys } from "@/lib/query-client";
import { PlayerDetailStats } from "@/types/leaderboards";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export function useLeaderboards() {
    useTickQuery(queryKeys.leaderboards.all);
    return useQuery({
        queryKey: queryKeys.leaderboards.all,
        queryFn: playerApi.getLeaderboards,
        // Keep data fresh for 5 minutes
        staleTime: 5 * 60 * 1000,
        // Keep data in cache for 10 minutes
        gcTime: 10 * 60 * 1000,
        // Refetch on window focus to ensure data is current
        refetchOnWindowFocus: true,
    });
}

/**
 * Hook for creating a map of player IDs to leaderboards details. Useful for
 * quickly looking up player names by ID.
 */
function useLeaderboardsMap() {
    const { data: leaderboards } = useLeaderboards();

    return useMemo(() => {
        if (!leaderboards) return undefined;
        const map: Record<number, PlayerDetailStats> = {};
        leaderboards.rows.forEach((row) => {
            map[row.player_id] = row;
        });
        return map;
    }, [leaderboards]);
}

/**
 * Hook for getting a specific leaderboard row by player ID. Returns undefined
 * if player data is not yet loaded and null if that player ID is not found.
 */
export function useLeaderboardsDetailStats(playerId: number) {
    const playerMap = useLeaderboardsMap();
    if (!playerMap) return undefined;
    return playerMap[playerId] ?? null;
}
