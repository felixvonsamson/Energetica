/**
 * TanStack Query client configuration and centralized query keys.
 *
 * ## What This File Does
 *
 * 1. **Query Client Setup**: Configures TanStack Query with sensible defaults for
 *    caching, retries, and error handling across the entire application.
 * 2. **Centralized Query Keys**: Defines ALL query keys used throughout the app in
 *    one place. This is critical because:
 *
 *    - Backend can invalidate frontend cache by referencing these same keys via
 *         Socket.IO
 *    - Prevents typos and ensures consistency across the codebase
 *    - Makes refactoring easier (change key structure in one place)
 *
 * ## Query Key Pattern
 *
 * Query keys follow a hierarchical structure from general to specific:
 *
 * ```ts
 * ["domain", "resource", ...specificParams];
 * // Example: ["charts", "markets", marketId, "exports", resolution, startTick, count]
 * ```
 *
 * ## Backend Cache Invalidation
 *
 * The backend invalidates frontend caches via Socket.IO by emitting query keys:
 *
 * ```python
 * player.emit("invalidate", {
 *     queries: [
 *         ["facilities", "all"],
 *         ["charts", "markets", market_id, "exports"],
 *     ],
 * });
 * ```
 *
 * These keys MUST match the structure defined in queryKeys below.
 *
 * IMPORTANT: Never hardcode query keys elsewhere - always import from this
 * file.
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
                    const status = (error as unknown as { status: number })
                        .status;
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
        statuses: ["facilities", "statuses"] as const,
    },
    charts: {
        powerSources: (resolution: string, startTick: number, count: number) =>
            ["charts", "power-sources", resolution, startTick, count] as const,
        powerSinks: (resolution: string, startTick: number, count: number) =>
            ["charts", "power-sinks", resolution, startTick, count] as const,
        storageLevel: (resolution: string, startTick: number, count: number) =>
            ["charts", "storage-level", resolution, startTick, count] as const,
        revenues: (resolution: string, startTick: number, count: number) =>
            ["charts", "revenues", resolution, startTick, count] as const,
        opCosts: (resolution: string, startTick: number, count: number) =>
            ["charts", "op-costs", resolution, startTick, count] as const,
        emissions: (resolution: string, startTick: number, count: number) =>
            ["charts", "emissions", resolution, startTick, count] as const,
        climate: (resolution: string, startTick: number, count: number) =>
            ["charts", "climate", resolution, startTick, count] as const,
        temperature: (resolution: string, startTick: number, count: number) =>
            ["charts", "temperature", resolution, startTick, count] as const,
        resources: (resolution: string, startTick: number, count: number) =>
            ["charts", "resources", resolution, startTick, count] as const,
        marketClearingData: (
            marketId: number,
            resolution: string,
            startTick: number,
            count: number,
        ) =>
            [
                "charts",
                "markets",
                marketId,
                "clearing-data",
                resolution,
                startTick,
                count,
            ] as const,
        marketExports: (
            marketId: number,
            resolution: string,
            startTick: number,
            count: number,
        ) =>
            [
                "charts",
                "markets",
                marketId,
                "exports",
                resolution,
                startTick,
                count,
            ] as const,
        marketImports: (
            marketId: number,
            resolution: string,
            startTick: number,
            count: number,
        ) =>
            [
                "charts",
                "markets",
                marketId,
                "imports",
                resolution,
                startTick,
                count,
            ] as const,
        marketGeneration: (
            marketId: number,
            resolution: string,
            startTick: number,
            count: number,
        ) =>
            [
                "charts",
                "markets",
                marketId,
                "generation",
                resolution,
                startTick,
                count,
            ] as const,
        marketConsumption: (
            marketId: number,
            resolution: string,
            startTick: number,
            count: number,
        ) =>
            [
                "charts",
                "markets",
                marketId,
                "consumption",
                resolution,
                startTick,
                count,
            ] as const,
        marketOrderData: (marketId: number, tick: number) =>
            ["charts", "markets", marketId, "orders", tick] as const,
    },
    powerPriorities: {
        all: ["power-priorities"] as const,
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
    electricityMarkets: {
        all: ["electricity-markets"] as const,
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
    shipments: {
        all: ["shipments"] as const,
    },
    leaderboards: {
        all: ["leaderboards"] as const,
    },
    chats: {
        list: ["chats"] as const,
        messages: (chatId: number) => ["chats", chatId, "messages"] as const,
    },
    notifications: {
        all: ["notifications"] as const,
    },
    game: {
        engine: ["game", "engine"] as const,
    },
    map: {
        all: ["map"] as const,
    },
    resourceMarket: {
        asks: ["resource-market", "asks"] as const,
        deliveryTime: (askId: number) =>
            ["resource-market", "delivery-time", askId] as const,
    },
    browserNotifications: {
        vapidKey: ["browser-notifications", "vapid-key"] as const,
    },
} as const;
