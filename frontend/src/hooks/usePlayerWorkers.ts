/**
 * Hook for fetching and managing player workers.
 *
 * Uses server-driven updates via SocketIO "worker_info" events instead of
 * tick-based refetching, since workers only change on specific actions:
 * - Starting/pausing/resuming projects
 * - Projects finishing
 * - Gaining new workers
 *
 * This is more efficient than refetching every tick (workers change ~10% of ticks).
 */

import { useQuery } from "@tanstack/react-query";
import { playerApi } from "@/lib/player-api";
import { queryKeys } from "@/lib/query-client";

export function usePlayerWorkers() {
    // NOTE: We DON'T use useTickQuery here!
    // Workers are updated via SocketIO "worker_info" events (see GameTickContext)

    return useQuery({
        queryKey: queryKeys.players.workers,
        queryFn: playerApi.getWorkers,
        // Keep data fresh for longer since we rely on SocketIO updates
        staleTime: 5 * 60 * 1000,
        // Keep data in cache for 10 minutes
        gcTime: 10 * 60 * 1000,
        // Refetch on window focus as a fallback (catches any missed events)
        refetchOnWindowFocus: true,
    });
}
