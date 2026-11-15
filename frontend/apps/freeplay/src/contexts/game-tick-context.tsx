/**
 * Game Tick Context
 *
 * Manages tick-based synchronization and server-driven invalidations.
 *
 * Two invalidation strategies:
 *
 * 1. Tick-based: Queries registered with useTickQuery auto-invalidate on ticks
 * 2. Event-based: Server sends "invalidate" events for specific queries
 *
 * TanStack Query's lazy refetching ensures queries only refetch if:
 *
 * - They have active observers (component is mounted and using the data)
 * - They are marked as stale
 *
 * This means invalidated data won't cause network requests unless it's actually
 * being displayed.
 */

import { useQueryClient } from "@tanstack/react-query";
import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    type ReactNode,
} from "react";

import { useSocketEvent } from "@/contexts/socket-context";
import { playerApi } from "@/lib/api/player";

interface GameTickContextValue {
    /** Current tick number from the server */
    currentTick: number | undefined;
    /** Whether the initial tick is still loading */
    isLoadingTick: boolean;
    /** Real-world timestamp (ms) when the last tick was received */
    lastTickTimestamp: number | undefined;
}

export const GameTickContext = createContext<GameTickContextValue | undefined>(
    undefined,
);

interface GameTickProviderProps {
    children: ReactNode;
}

interface TickEventData {
    tick: number;
}

interface InvalidateEventData {
    /** Array of query keys to invalidate */
    queries: (readonly unknown[])[];
}

export function GameTickProvider({ children }: GameTickProviderProps) {
    const queryClient = useQueryClient();
    const [currentTick, setCurrentTick] = useState<number | undefined>(
        undefined,
    );
    const [isLoadingTick, setIsLoadingTick] = useState(true);
    const [lastTickTimestamp, setLastTickTimestamp] = useState<
        number | undefined
    >(undefined);
    const [registeredTickQueries, setRegisteredTickQueries] = useState<
        Set<string>
    >(new Set());

    // Fetch initial current tick on mount
    useEffect(() => {
        playerApi
            .getGameState()
            .then((gameState) => {
                console.log(
                    `[GameTick] Initial tick loaded: ${gameState.current_tick}`,
                );
                setCurrentTick(gameState.current_tick);
                setIsLoadingTick(false);
            })
            .catch((error) => {
                console.error(
                    "[GameTick] Failed to fetch initial tick:",
                    error,
                );
                // Still mark as loaded to avoid blocking forever
                setIsLoadingTick(false);
            });
    }, []);

    // Invalidate all tick-registered queries
    const invalidateTickQueries = useCallback(async () => {
        if (registeredTickQueries.size === 0) return;

        console.log(
            `[GameTick] Invalidating ${registeredTickQueries.size} tick-registered queries`,
        );
        const invalidations = Array.from(registeredTickQueries).map((key) =>
            queryClient.invalidateQueries({
                queryKey: JSON.parse(key),
            }),
        );
        await Promise.all(invalidations);
    }, [queryClient, registeredTickQueries]);

    // Manually invalidate specific queries
    const invalidateQueries = useCallback(
        async (queryKeys: readonly (readonly unknown[])[]) => {
            console.log(
                `[GameTick] Manually invalidating ${queryKeys.length} queries`,
            );
            const invalidations = queryKeys.map((queryKey) =>
                queryClient.invalidateQueries({ queryKey }),
            );
            await Promise.all(invalidations);
        },
        [queryClient],
    );

    // Register a query key for tick-based refetching
    const registerTickQuery = useCallback((queryKey: readonly unknown[]) => {
        const key = JSON.stringify(queryKey);
        setRegisteredTickQueries((prev) => new Set(prev).add(key));
    }, []);

    // Unregister a query key
    const unregisterTickQuery = useCallback((queryKey: readonly unknown[]) => {
        const key = JSON.stringify(queryKey);
        setRegisteredTickQueries((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
        });
    }, []);

    // Listen for tick events from the server
    useSocketEvent<TickEventData>("tick", (data) => {
        console.log(`[GameTick] Tick event received: ${data.tick}`);
        setCurrentTick(data.tick);
        setLastTickTimestamp(Date.now());
        invalidateTickQueries();
    });

    // Listen for server-driven invalidation events
    useSocketEvent<InvalidateEventData>("invalidate", (data) => {
        console.log(
            `[GameTick] Invalidate event received for ${data.queries.length} queries:`,
            data.queries,
        );
        invalidateQueries(data.queries);
    });

    const value: GameTickContextValue = {
        currentTick,
        isLoadingTick,
        lastTickTimestamp,
    };

    // Expose registration functions via context (internal use only)
    return (
        <GameTickContext.Provider value={value}>
            <TickQueryRegistration.Provider
                value={{ registerTickQuery, unregisterTickQuery }}
            >
                {children}
            </TickQueryRegistration.Provider>
        </GameTickContext.Provider>
    );
}

// Internal context for query registration
const TickQueryRegistration = createContext<{
    registerTickQuery: (queryKey: readonly unknown[]) => void;
    unregisterTickQuery: (queryKey: readonly unknown[]) => void;
} | null>(null);

/**
 * Hook to automatically register a query for tick-based refetching. The query
 * will be invalidated on each game tick.
 *
 * Use this for data that ALWAYS changes on ticks (e.g., production values,
 * time-based state). For data that only changes on user actions, rely on server
 * "invalidate" events instead.
 *
 * @param queryKey - The query key to register
 */
export function useTickQuery(queryKey: readonly unknown[]) {
    const context = useContext(TickQueryRegistration);
    if (!context) {
        throw new Error("useTickQuery must be used within GameTickProvider");
    }

    const { registerTickQuery, unregisterTickQuery } = context;

    useEffect(() => {
        registerTickQuery(queryKey);
        return () => unregisterTickQuery(queryKey);
    }, [queryKey, registerTickQuery, unregisterTickQuery]);
}
