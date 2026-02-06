/**
 * Hook for fetching and managing player workers.
 *
 * Uses server-driven updates via SocketIO "worker_info" events instead of
 * tick-based refetching, since workers only change on specific actions:
 *
 * - Starting/pausing/resuming projects
 * - Projects finishing
 * - Gaining new workers
 *
 * This is more efficient than refetching every tick (workers change ~10% of
 * ticks).
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useSocketEvent } from "@/contexts/socket-context";
import { playerApi } from "@/lib/api/player";
import { queryKeys } from "@/lib/query-client";

export function usePlayerWorkers() {
    const queryClient = useQueryClient();

    // NOTE: We DON'T use useTickQuery here!
    // Workers are updated via SocketIO "worker_info" events

    // Listen for worker info updates (sent when workers change)
    useSocketEvent("worker_info", (data) => {
        console.log("[Workers] Worker info updated:", data);
        queryClient.setQueryData(queryKeys.players.workers, data);
    });

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
