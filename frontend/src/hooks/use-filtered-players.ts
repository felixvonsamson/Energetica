import { useMemo } from "react";

import type { Player } from "@/types/chats";

/**
 * Hook to filter players by search input, excluding current user and specified
 * players
 *
 * @param playersData - All available players
 * @param searchInput - Text to filter players by username
 * @param currentUserId - ID of current user to exclude
 * @param excludePlayerIds - Additional player IDs to exclude from results
 * @returns Filtered list of players
 */
export function useFilteredPlayers(
    playersData: Player[] | undefined,
    searchInput: string,
    currentUserId: number | null | undefined,
    excludePlayerIds?: number[],
) {
    return useMemo(() => {
        const excluded = new Set<number>();
        if (currentUserId) {
            excluded.add(currentUserId);
        }
        (excludePlayerIds || []).forEach((id) => excluded.add(id));

        const players = (playersData || []).filter(
            (player) => !excluded.has(player.id),
        );

        // If search input is empty, return all available players
        if (!searchInput.trim()) {
            return players;
        }

        // Otherwise filter by search input
        return players.filter((player) =>
            player.username.toLowerCase().includes(searchInput.toLowerCase()),
        );
    }, [playersData, searchInput, currentUserId, excludePlayerIds]);
}
