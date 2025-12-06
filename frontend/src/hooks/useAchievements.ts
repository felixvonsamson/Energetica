/**
 * Hooks for achievement functionality. Achievements track player progress
 * towards various milestones.
 */

import { useQuery } from "@tanstack/react-query";
import { achievementApi } from "@/lib/api/achievement";
import { queryKeys } from "@/lib/query-client";
import { useTickQuery } from "@/contexts/GameTickContext";

/**
 * Hook to fetch the player's upcoming achievements. Returns achievements that
 * are in progress or nearly complete. Automatically refreshes on tick events
 * for real-time progress updates.
 */
export function useAchievements() {
    // Register for tick-based invalidation to keep progress up-to-date
    useTickQuery(queryKeys.achievements.upcoming);

    return useQuery({
        queryKey: queryKeys.achievements.upcoming,
        queryFn: achievementApi.getUpcoming,
        // Achievements update on game ticks, keep relatively fresh
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 5 * 60 * 1000, // 5 minutes
        // Refetch when window regains focus in case progress changed
        refetchOnWindowFocus: true,
    });
}
