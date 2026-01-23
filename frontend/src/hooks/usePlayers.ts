/**
 * Hook for fetching all players. Used for community features like chat
 * participant lists and leaderboards.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useAuth } from "@/hooks/useAuth";
import { playerApi } from "@/lib/api/player";
import { queryKeys } from "@/lib/query-client";
import { Player } from "@/types/players";

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

/**
 * Hook for creating a map of player IDs to usernames. Useful for quickly
 * looking up player names by ID.
 */
export function usePlayerMap() {
    const { data: playersData } = usePlayers();

    return useMemo(() => {
        if (!playersData) return undefined;
        const map: Record<number, Player> = {};
        playersData.forEach((player) => {
            map[player.id] = player;
        });
        return map;
    }, [playersData]);
}

/**
 * Hook for getting the current player's ID. Useful as a shorthand for
 * useAuth().user?.player_id when you just need the ID.
 */
export function useMyId() {
    const { user } = useAuth();
    if (user === null) return null;
    const player_id = user.player_id;
    if (player_id === null || player_id === undefined) return null;
    return player_id;
}

/**
 * Hook for getting the current player's username. Returns null if player data
 * is not yet loaded or the player is not found.
 */
export function useMe() {
    const myId = useMyId();
    const playerMap = usePlayerMap();

    if (!myId || !playerMap) {
        return undefined;
    }

    return playerMap[myId];
}

/**
 * Hook for getting a specific player by ID. Returns null if player data is not
 * yet loaded or the player is not found.
 */
export function usePlayer(playerId: number) {
    const { data: playersData } = usePlayers();

    return useMemo(() => {
        if (!playersData) return undefined;
        return playersData.find((p) => p.id === playerId) ?? null;
    }, [playersData, playerId]);
}
