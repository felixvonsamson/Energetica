/**
 * TanStack Query client configuration and centralized query keys.
 *
 * ## What This File Does
 *
 * 1. **Query Client Setup**: Creates this app's query client from the shared
 *    factory in `@energetica/core/query-client`, which sets the defaults for
 *    caching and retries. Mutations are not retried unless they opt in.
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

import { handleApiError } from "@/lib/error-utils";
import { isInstanceFrozenError } from "@/lib/lifecycle";
import { createQueryClient } from "@energetica/core/query-client";

export const queryClient = createQueryClient({
    onMutationError: (error) => {
        // The backend refused a game action because the run has frozen (#866). The client usually
        // sees freeze coming from `freeze_at`, so this means its copy is stale, e.g. an admin moved
        // `freeze_at` earlier. Re-read it and the game turns read-only in place.
        if (isInstanceFrozenError(error)) {
            void queryClient.invalidateQueries({
                queryKey: queryKeys.game.engine,
            });
            return;
        }
        handleApiError(error);
    },
});

/** Query keys for consistent cache management. Organized by domain/feature. */
export const queryKeys = {
    auth: {
        me: ["auth", "me"] as const,
    },
    lobby: {
        myRuns: ["lobby", "my-runs"] as const,
    },
    run: ["run"] as const,
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
        climateEventRecoveries: [
            "weather",
            "climate-event-recoveries",
        ] as const,
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
        feedSubscriptions: ["notifications", "feed-subscriptions"] as const,
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
        vapidKey: ["push-subscriptions", "vapid-key"] as const,
    },
    // `facilitator` and `join` belong to `@energetica/instance`, which owns their queries: see
    // `instanceQueryKeys` there.
} as const;
