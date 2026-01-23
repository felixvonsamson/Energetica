# Data Fetching

Comprehensive guide to data fetching, caching, and synchronization patterns in Energetica.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [TanStack Query](#tanstack-query)
3. [API Client](#api-client)
4. [Query Patterns](#query-patterns)
5. [Mutation Patterns](#mutation-patterns)
6. [Cache Invalidation](#cache-invalidation)
7. [Tick-Based Queries](#tick-based-queries)
8. [Error Handling](#error-handling)
9. [Common Patterns Reference](#common-patterns-reference)
10. [Best Practices](#best-practices)

## Architecture Overview

Energetica uses a three-layer data fetching architecture:

```
┌─────────────────┐
│   Components    │ ← Use custom hooks (useProjects, useFacilities)
└────────┬────────┘
         │
┌────────▼────────┐
│  Custom Hooks   │ ← Wrap TanStack Query (useQuery, useMutation)
│  (hooks/*.ts)   │
└────────┬────────┘
         │
┌────────▼────────┐
│   API Layer     │ ← Type-safe API clients (lib/api/*.ts)
│ (lib/api/*.ts)  │
└────────┬────────┘
         │
┌────────▼────────┐
│   API Client    │ ← HTTP wrapper with error handling
│ (api-client.ts) │
└────────┬────────┘
         │
      Backend
```

**Key architectural decisions:**

-   **Centralized query keys**: All query keys defined in `lib/query-client.ts`
-   **Type safety**: TypeScript types generated from OpenAPI schema
-   **Separation of concerns**: API calls separated from query logic
-   **Cache synchronization**: Backend-driven invalidation via Socket.IO

## TanStack Query

Pre-configured query client with sensible defaults for Energetica's game mechanics.

### Configuration

The query client (`lib/query-client.ts`) is configured with:

```ts
{
    queries: {
        staleTime: 5 * 60 * 1000,        // 5 minutes default
        gcTime: 10 * 60 * 1000,          // 10 minutes garbage collection
        retry: 3,                         // Retry failed requests (except 4xx)
        refetchOnWindowFocus: true,       // Refetch on window focus
        refetchOnMount: true,             // Refetch if stale on mount
        refetchOnReconnect: true,         // Refetch on connection restore
        networkMode: "online",            // Only fetch when online
    },
    mutations: {
        retry: 1,                         // Retry mutations cautiously
        networkMode: "online",
    }
}
```

### Basic Usage

```ts
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { playerApi } from "@/lib/api/player";

function usePlayerMoney() {
    return useQuery({
        queryKey: queryKeys.players.money,
        queryFn: playerApi.getMoney,
    });
}
```

**In components:**

```tsx
function WalletDisplay() {
    const { data: money, isLoading, error } = usePlayerMoney();

    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>Error: {error.message}</div>;

    return <div>Balance: ${money.balance}</div>;
}
```

## API Client

Type-safe HTTP wrapper with automatic error handling.

### Features

-   **Automatic JSON parsing**: Responses parsed automatically
-   **Cookie credentials**: Authentication cookies included
-   **Type safety**: Full TypeScript support
-   **Error handling**: Errors wrapped in `ApiClientError`
-   **Query parameters**: Easy URL parameter building

### Methods

```ts
import { apiClient } from "@/lib/api-client";

// GET request
const data = await apiClient.get<ResponseType>("/endpoint");

// POST request (with body)
const result = await apiClient.post("/endpoint", { key: "value" });

// POST request (AIP-136 style action)
await apiClient.post("/facilities/123:start");

// PATCH request
await apiClient.patch("/players/me/settings", { theme: "dark" });

// DELETE request
await apiClient.delete("/asks/456");

// With query parameters
const data = await apiClient.get("/endpoint", {
    params: { page: 1, limit: 10 },
});
```

### API Layer Structure

API functions are organized by domain in `lib/api/`:

```ts
// lib/api/player.ts
export const playerApi = {
    getMoney: () =>
        apiClient.get<ApiResponse<"/api/v1/players/me/money", "get">>(
            "/players/me/money"
        ),

    getResources: () =>
        apiClient.get<ApiResponse<"/api/v1/players/me/resources", "get">>(
            "/players/me/resources"
        ),
};
```

**Type safety:** `ApiResponse` is a helper type that extracts response types from the generated OpenAPI schema.

## Query Patterns

### Simple Query

For basic data fetching:

```ts
export function usePlayerMoney() {
    return useQuery({
        queryKey: queryKeys.players.money,
        queryFn: playerApi.getMoney,
        staleTime: 60 * 1000, // 1 minute
    });
}
```

### Parameterized Query

For queries that depend on parameters:

```ts
export function useCalculateDeliveryTime(askId: number) {
    return useQuery({
        queryKey: queryKeys.resourceMarket.deliveryTime(askId),
        queryFn: () => resourceMarketApi.calculateDeliveryTime(askId),
        staleTime: 60 * 1000,
        // Only run if askId is valid
        enabled: askId > 0,
    });
}
```

**Key points:**

-   Query key includes the parameter: `deliveryTime(askId)`
-   Arrow function captures the parameter in `queryFn`
-   Use `enabled` to conditionally run the query

### Conditional Query

For queries that should only run under certain conditions:

```ts
export function usePlayerProfile(playerId: number | null) {
    return useQuery({
        queryKey: queryKeys.players.byId(playerId!),
        queryFn: () => playerApi.getById(playerId!),
        enabled: playerId !== null, // Only fetch if ID is available
    });
}
```

### Cached/Infrequent Query

For data that changes rarely (configs, catalogs):

```ts
export function useTechnologiesCatalog() {
    return useQuery({
        queryKey: queryKeys.projects.catalog.technologies,
        queryFn: projectsApi.getTechnologiesCatalog,
        staleTime: 10 * 60 * 1000, // 10 minutes
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false, // Don't refetch on focus
    });
}
```

## Mutation Patterns

### Basic Mutation

For simple actions without cache updates:

```ts
export function useUpdateSettings() {
    return useMutation({
        mutationFn: settingsApi.updateSettings,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.players.settings,
            });
        },
    });
}
```

**Usage in components:**

```tsx
function SettingsForm() {
    const { mutate, isPending, error } = useUpdateSettings();

    const handleSubmit = (data: SettingsUpdate) => {
        mutate(data, {
            onSuccess: () => {
                toast.success("Settings updated");
            },
            onError: (error) => {
                toast.error(error.message);
            },
        });
    };

    return <form onSubmit={handleSubmit}>...</form>;
}
```

### Mutation with Multiple Invalidations

For actions that affect multiple data sources:

```ts
export function useQueueProject() {
    return useMutation({
        mutationFn: projectsApi.queueProject,
        onSuccess: () => {
            // Invalidate projects list (new project added)
            queryClient.invalidateQueries({
                queryKey: queryKeys.projects.all,
            });
            // Invalidate money (construction costs money)
            queryClient.invalidateQueries({
                queryKey: queryKeys.players.money,
            });
            // Invalidate workers (may affect available workers)
            queryClient.invalidateQueries({
                queryKey: queryKeys.players.workers,
            });
        },
    });
}
```

### Optimistic Update

For immediate UI feedback before server confirmation:

```ts
export function useUpdateAsk() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: resourceMarketApi.updateAsk,
        // Before mutation starts
        onMutate: async (variables) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({
                queryKey: queryKeys.resourceMarket.asks,
            });

            // Snapshot previous value
            const previousAsks = queryClient.getQueryData(
                queryKeys.resourceMarket.asks
            );

            // Optimistically update cache
            queryClient.setQueryData(
                queryKeys.resourceMarket.asks,
                (old: Ask[]) =>
                    old.map((ask) =>
                        ask.id === variables.askId
                            ? { ...ask, ...variables.updates }
                            : ask
                    )
            );

            // Return context with snapshot
            return { previousAsks };
        },
        // On error, rollback
        onError: (err, variables, context) => {
            queryClient.setQueryData(
                queryKeys.resourceMarket.asks,
                context?.previousAsks
            );
        },
        // Always refetch after success or error
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.resourceMarket.asks,
            });
        },
    });
}
```

### Mutation with Error Handling

For mutations with detailed error handling:

```ts
export function usePurchaseAsk() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: resourceMarketApi.purchaseAsk,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.resourceMarket.asks,
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.players.money,
            });
        },
        // Error handling happens at component level
    });
}

// In component:
function PurchaseButton({ askId }: { askId: number }) {
    const { mutate, isPending } = usePurchaseAsk();

    const handlePurchase = () => {
        mutate(askId, {
            onError: (error) => {
                if (error instanceof ApiClientError) {
                    if (isGameError(error.detail)) {
                        // Handle game-specific errors
                        if (
                            error.detail.game_exception_type ===
                            "InsufficientFunds"
                        ) {
                            toast.error("Not enough money");
                        }
                    } else {
                        toast.error(error.getErrorMessage());
                    }
                }
            },
        });
    };

    return (
        <button onClick={handlePurchase} disabled={isPending}>
            {isPending ? "Purchasing..." : "Buy"}
        </button>
    );
}
```

## Cache Invalidation

Energetica uses two cache invalidation strategies:

### 1. Manual Invalidation

Called after mutations to update related queries:

```ts
// In mutation hook
onSuccess: () => {
    queryClient.invalidateQueries({
        queryKey: queryKeys.projects.all,
    });
};
```

**Common invalidation patterns:**

```ts
// Invalidate exact query
queryClient.invalidateQueries({
    queryKey: queryKeys.players.money,
});

// Invalidate all queries in a domain
queryClient.invalidateQueries({
    queryKey: queryKeys.facilities.all,
});

// Invalidate multiple related queries
queryClient.invalidateQueries({
    queryKey: queryKeys.players.money,
});
queryClient.invalidateQueries({
    queryKey: queryKeys.players.resources,
});
```

### 2. Server-Driven Invalidation

Backend sends invalidation events via Socket.IO:

```python
# Backend (Python)
player.emit("invalidate", {
    "queries": [
        ["facilities", "all"],
        ["players", "me", "money"],
    ]
})
```

**Frontend handling** (automatic via `GameTickContext`):

```ts
// GameTickContext listens for invalidation events
useSocketEvent<InvalidateEventData>("invalidate", (data) => {
    console.log(`Invalidate event received for ${data.queries.length} queries`);
    data.queries.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
    });
});
```

**Critical:** Query keys in backend events must match `frontend/src/lib/query-client.ts` exactly.

## Tick-Based Queries

For data that updates every game tick (60 seconds):

### Using useTickQuery

```ts
import { useTickQuery } from "@/contexts/GameTickContext";

export function usePlayerMoney() {
    // Register this query to refetch on each tick
    useTickQuery(queryKeys.players.money);

    return useQuery({
        queryKey: queryKeys.players.money,
        queryFn: playerApi.getMoney,
        // Keep fresh for full tick duration
        staleTime: 60 * 1000,
    });
}
```

### How It Works

1. `useTickQuery` registers the query key with `GameTickContext`
2. Backend emits `tick` event every 60 seconds
3. Context automatically invalidates all registered queries
4. TanStack Query refetches data (if component is mounted)

**When to use tick queries:**

-   ✅ Production values (changes every tick)
-   ✅ Time-based state (projects progress, storage levels)
-   ✅ Resource amounts (extracted/consumed each tick)
-   ❌ User actions (use server invalidation events)
-   ❌ Static data (configs, catalogs)

### Tick Context API

```ts
import { useGameTick } from "@/hooks/useGameTick";

function GameClock() {
    const { currentTick, isLoadingTick } = useGameTick();

    return <div>Current tick: {currentTick}</div>;
}
```

## Error Handling

### ApiClientError

All API errors are wrapped in `ApiClientError`:

```ts
export class ApiClientError extends Error {
    constructor(
        message: string,
        public status: number, // HTTP status code
        public detail?: ApiErrorResponse // Structured error details
    ) {}

    getErrorMessage(): string {
        // Returns user-friendly error message
    }
}
```

### Error Types

**1. HTTP Errors** (standard errors):

```ts
{
    detail: "Not found";
}
```

**2. Game Errors** (business logic errors):

```ts
{
    game_exception_type: "InsufficientFunds",
    kwargs: { required: 1000, available: 500 }
}
```

**3. Validation Errors** (Pydantic):

```ts
{
    detail: [
        { loc: ["body", "price"], msg: "must be positive", type: "value_error" }
    ],
    meta: { error_type: "validation_error" }
}
```

### Type Guards

```ts
import { isHttpError, isGameError, isValidationError } from "@/lib/api-client";

function handleError(error: unknown) {
    if (error instanceof ApiClientError) {
        if (isGameError(error.detail)) {
            // Handle game-specific errors
            console.log(error.detail.game_exception_type);
        } else if (isValidationError(error.detail)) {
            // Handle validation errors
            error.detail.detail.forEach((e) => console.log(e.msg));
        } else if (isHttpError(error.detail)) {
            // Handle HTTP errors
            console.log(error.detail.detail);
        }
    }
}
```

### Error Handling in Queries

```tsx
function MoneyDisplay() {
    const { data, error, isLoading } = usePlayerMoney();

    if (error) {
        if (error instanceof ApiClientError) {
            return <ErrorMessage>{error.getErrorMessage()}</ErrorMessage>;
        }
        return <ErrorMessage>An unexpected error occurred</ErrorMessage>;
    }

    if (isLoading) return <Skeleton />;

    return <div>${data.balance}</div>;
}
```

### Error Handling in Mutations

```tsx
function CreateProjectButton() {
    const { mutate, error, isPending } = useQueueProject();

    const handleClick = () => {
        mutate(projectData, {
            onError: (error) => {
                if (error instanceof ApiClientError) {
                    if (isGameError(error.detail)) {
                        // Show game-specific error
                        toast.error(error.detail.game_exception_type);
                    } else {
                        toast.error(error.getErrorMessage());
                    }
                }
            },
        });
    };

    return <button onClick={handleClick}>Create Project</button>;
}
```

## Common Patterns Reference

| Pattern                 | When to Use                                      | Example Hook             |
| ----------------------- | ------------------------------------------------ | ------------------------ |
| **Simple Query**        | Basic data fetching                              | `usePlayerMoney`         |
| **Tick Query**          | Data that changes every game tick                | `useProjects`            |
| **Cached Query**        | Rarely-changing data (configs, catalogs)         | `useTechnologiesCatalog` |
| **Parameterized Query** | Query depends on dynamic parameter               | `useCalculateDelivery`   |
| **Conditional Query**   | Query should only run when condition met         | `usePlayerProfile`       |
| **Simple Mutation**     | Action with single cache invalidation            | `useUpdateSettings`      |
| **Multi-Invalidate**    | Action affects multiple data sources             | `useQueueProject`        |
| **Optimistic Update**   | Immediate UI feedback before server confirmation | `useUpdateAsk`           |
| **Server Invalidation** | Backend triggers cache update via Socket.IO      | Automatic in context     |
| **Error Handling**      | Detailed error handling with type guards         | `usePurchaseAsk`         |

## Best Practices

### Query Keys

**✅ Do:**

-   Use centralized query keys from `lib/query-client.ts`
-   Make keys hierarchical: `["players", "me", "money"]`
-   Include parameters in keys: `deliveryTime(askId)`

**❌ Don't:**

-   Hardcode query keys in hooks: `["players"]`
-   Use inconsistent key structures
-   Forget to update backend invalidation events when changing keys

### Caching Strategy

**✅ Do:**

-   Set appropriate `staleTime` based on data volatility
-   Use tick queries for time-based data
-   Disable `refetchOnWindowFocus` for static data

**❌ Don't:**

-   Use same `staleTime` for all queries
-   Over-invalidate (hurts performance)
-   Under-invalidate (stale data)

### Mutations

**✅ Do:**

-   Invalidate all affected queries in `onSuccess`
-   Handle errors at component level for better UX
-   Use optimistic updates for instant feedback

**❌ Don't:**

-   Forget to invalidate related queries
-   Show generic error messages
-   Over-use optimistic updates (complex rollback logic)

### API Layer

**✅ Do:**

-   Keep API functions separate from hooks
-   Use typed responses with `ApiResponse` helper
-   Group API functions by domain (`playerApi`, `projectsApi`)

**❌ Don't:**

-   Call `apiClient` directly in hooks
-   Duplicate API functions across files
-   Mix API logic with component logic

### Error Handling

**✅ Do:**

-   Use type guards to narrow error types
-   Show user-friendly error messages
-   Log errors for debugging

**❌ Don't:**

-   Show raw error messages to users
-   Ignore errors silently
-   Catch all errors without type checking
