/**
 * TanStack Query client configuration. Provides sensible defaults for caching
 * and error handling.
 */

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Cache data for 5 minutes by default
            staleTime: 5 * 60 * 1000,
            // Keep unused data in cache for 10 minutes
            gcTime: 10 * 60 * 1000,
            // Retry failed requests - important for mobile users with spotty connections
            retry: (failureCount, error) => {
                // Don't retry on 4xx errors (client errors)
                if (error instanceof Error && "status" in error) {
                    const status = (error as any).status;
                    if (status >= 400 && status < 500) return false;
                }
                // Retry up to 3 times for network errors
                return failureCount < 3;
            },
            // Exponential backoff for retries (better for mobile)
            retryDelay: (attemptIndex) =>
                Math.min(1000 * 2 ** attemptIndex, 30000),
            // Refetch on window focus for important data
            refetchOnWindowFocus: true,
            // Refetch on mount if data is stale
            refetchOnMount: true,
            // Refetch when connection restored
            refetchOnReconnect: true,
            // Network mode: 'online' = only fetch when online, keep stale data when offline
            networkMode: "online",
        },
        mutations: {
            // Retry failed mutations once (cautious with mutations to avoid duplicates)
            retry: 1,
            // Network mode for mutations
            networkMode: "online",
        },
    },
});

/** Query keys for consistent cache management. Organized by domain/feature. */
export const queryKeys = {
    auth: {
        me: ["auth", "me"] as const,
    },
    players: {
        all: ["players"] as const,
        me: ["players", "me"] as const,
        byId: (id: number) => ["players", id] as const,
        money: ["players", "me", "money"] as const,
        workers: ["players", "me", "workers"] as const,
        resources: ["players", "me", "resources"] as const,
        profile: ["players", "me", "profile"] as const,
        settings: ["players", "me", "settings"] as const,
    },
    facilities: {
        all: ["facilities"] as const,
        power: ["facilities", "power"] as const,
        storage: ["facilities", "storage"] as const,
        extraction: ["facilities", "extraction"] as const,
        functional: ["facilities", "functional"] as const,
    },
    charts: {
        powerSources: (resolution: string, startTick: number, count: number) =>
            ["charts", "power-sources", resolution, startTick, count] as const,
        powerSinks: (resolution: string, startTick: number, count: number) =>
            ["charts", "power-sinks", resolution, startTick, count] as const,
    },
    network: {
        all: ["networks"] as const,
        capacities: ["networks", "capacities"] as const,
    },
    config: {
        const: ["config", "const"] as const,
    },
    weather: {
        current: ["weather", "current"] as const,
    },
    dailyQuiz: {
        today: ["daily-quiz", "today"] as const,
    },
    achievements: {
        upcoming: ["achievements", "upcoming"] as const,
    },
    projects: {
        all: ["projects"] as const,
        catalog: {
            powerFacilities: [
                "projects",
                "catalog",
                "power-facilities",
            ] as const,
            storageFacilities: [
                "projects",
                "catalog",
                "storage-facilities",
            ] as const,
            extractionFacilities: [
                "projects",
                "catalog",
                "extraction-facilities",
            ] as const,
            functionalFacilities: [
                "projects",
                "catalog",
                "functional-facilities",
            ] as const,
            technologies: ["projects", "catalog", "technologies"] as const,
        },
    },
    scoreboard: {
        all: ["scoreboard"] as const,
    },
    chats: {
        list: ["chats"] as const,
        messages: (chatId: number) => ["chats", chatId, "messages"] as const,
    },
} as const;
