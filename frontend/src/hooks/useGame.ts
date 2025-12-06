/**
 * Hooks for fetching game engine configuration.
 *
 * Game engine settings control the passage of time and simulation speed in the
 * game world.
 */

import { useQuery } from "@tanstack/react-query";
import { gameApi } from "@/lib/api/game";
import { queryKeys } from "@/lib/query-client";

/**
 * Get game engine configuration (clock time and simulation speed).
 *
 * Engine configuration is loaded once and typically doesn't change during a
 * session, so it's cached with infinite stale time.
 *
 * @example
 *     const { data: engine } = useGameEngine();
 *     console.log(`Simulation speed: ${engine?.speed}x`);
 *
 * @returns Query result with game engine configuration
 */
export function useGameEngine() {
    return useQuery({
        queryKey: queryKeys.game.engine,
        queryFn: gameApi.getEngine,
        staleTime: Infinity, // Engine config doesn't change during a session
        gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });
}
