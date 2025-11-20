/**
 * TanStack Query client configuration.
 * Provides sensible defaults for caching and error handling.
 */

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Cache data for 5 minutes by default
            staleTime: 5 * 60 * 1000,
            // Keep unused data in cache for 10 minutes
            gcTime: 10 * 60 * 1000,
            // Retry failed requests once
            retry: 1,
            // Refetch on window focus for important data
            refetchOnWindowFocus: true,
            // Refetch on mount if data is stale
            refetchOnMount: true,
            // Don't refetch on reconnect by default
            refetchOnReconnect: false,
        },
        mutations: {
            // Retry failed mutations once
            retry: 1,
        },
    },
});

/**
 * Query keys for consistent cache management.
 * Organized by domain/feature.
 */
export const queryKeys = {
    auth: {
        me: ["auth", "me"] as const,
    },
    players: {
        all: ["players"] as const,
        me: ["players", "me"] as const,
        byId: (id: number) => ["players", id] as const,
        money: ["players", "me", "money"] as const,
    },
    facilities: {
        all: ["facilities"] as const,
        power: ["facilities", "power"] as const,
        storage: ["facilities", "storage"] as const,
        extraction: ["facilities", "extraction"] as const,
        functional: ["facilities", "functional"] as const,
    },
    charts: {
        data: ["charts", "data"] as const,
    },
    network: {
        all: ["networks"] as const,
        capacities: ["networks", "capacities"] as const,
    },
    config: {
        const: ["config", "const"] as const,
    },
} as const;
