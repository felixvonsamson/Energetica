/** Hooks for fetching game engine configuration. */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import type { ApiResponse } from "@/types/api-helpers";

/** Get game engine configuration (clock time and simulation speed). */
export function useGameEngine() {
    return useQuery({
        queryKey: queryKeys.game.engine,
        queryFn: () =>
            apiClient.get<ApiResponse<"/api/v1/game/engine", "get">>(
                "/game/engine",
            ),
        staleTime: Infinity, // Engine config doesn't change during a session
        gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });
}
