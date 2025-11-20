# API Integration & Types

Guide for integrating backend API calls with automatic type generation.

## Type Generation

Types are automatically generated from the FastAPI OpenAPI schema.

### Generate Types

```bash
# Backend must be running at http://localhost:5001
npm run generate-types
```

This creates `src/types/api.generated.ts` with all API types.

### Using Generated Types

```typescript
import { ApiResponse, ApiRequestBody } from "@/types/api-helpers";

// Response type for an endpoint
type User = ApiResponse<"/auth/me", "get">;

// Request body type
type LoginRequest = ApiRequestBody<"/auth/login", "post">;

// Use in your code
const user: User = await apiClient.get("/auth/me");
```

### Type Helpers

| Helper                         | Use Case       | Example                                 |
| ------------------------------ | -------------- | --------------------------------------- |
| `ApiResponse<Path, Method>`    | Response type  | `ApiResponse<"/auth/me", "get">`        |
| `ApiRequestBody<Path, Method>` | Request body   | `ApiRequestBody<"/auth/login", "post">` |
| `ApiPathParams<Path>`          | URL parameters | `ApiPathParams<"/facilities/{id}">`     |
| `ApiQueryParams<Path, Method>` | Query string   | `ApiQueryParams<"/players", "get">`     |
| `ApiSchema<Name>`              | Schema types   | `ApiSchema<"User">`                     |

### When to Regenerate

Run `npm run generate-types` when:

- Backend API endpoints change
- Request/response schemas change
- After pulling backend changes
- Before committing frontend changes

## API Client Structure

Organize API calls into modules in `src/lib/`:

```typescript
// src/lib/player-api.ts
import { apiClient } from "./api-client";
import type { ApiResponse, ApiRequestBody } from "@/types/api-helpers";

export const playerApi = {
    getMoney: () =>
        apiClient.get<ApiResponse<"/api/v1/players/me/money", "get">>(
            "/players/me/money",
        ),

    getResources: () =>
        apiClient.get<ApiResponse<"/api/v1/players/me/resources", "get">>(
            "/players/me/resources",
        ),
};
```

## Query Integration

### Query Keys

Define in `src/lib/query-client.ts`:

```typescript
export const queryKeys = {
    players: {
        money: ["players", "me", "money"] as const,
        resources: ["players", "me", "resources"] as const,
    },
    facilities: {
        all: ["facilities", "all"] as const,
    },
} as const;
```

### Custom Hooks

Create hooks in `src/hooks/`:

```typescript
// src/hooks/usePlayerMoney.ts
import { useQuery } from "@tanstack/react-query";
import { playerApi } from "@/lib/player-api";
import { queryKeys } from "@/lib/query-client";
import { useTickQuery } from "@/contexts/GameTickContext";

export function usePlayerMoney() {
    // Register for tick-based refetching
    useTickQuery(queryKeys.players.money);

    return useQuery({
        queryKey: queryKeys.players.money,
        queryFn: playerApi.getMoney,
        staleTime: 60 * 1000, // 1 minute
    });
}
```

## Query Invalidation

Two strategies for keeping data fresh:

### Tick-Based Invalidation

For data that changes every tick (production, storage levels):

```typescript
export function useElectricityProduction() {
    // Register for tick-based invalidation
    useTickQuery(queryKeys.production.electricity);

    return useQuery({
        queryKey: queryKeys.production.electricity,
        queryFn: productionApi.getElectricity,
        staleTime: 60 * 1000,
    });
}
```

When a tick occurs, all registered queries are invalidated.

### Event-Based Invalidation (Server-Driven)

For data that only changes on specific actions (facilities, money after purchases):

**Backend emits:**

```python
player.emit("invalidate", {
    "queries": [
        ["players", "me", "money"],
        ["facilities", "all"],
    ]
})
```

**Frontend automatically handles it** - no code needed in your hook:

```typescript
export function useFacilities() {
    // No useTickQuery - relies on server events
    return useQuery({
        queryKey: queryKeys.facilities.all,
        queryFn: facilitiesApi.getAll,
        staleTime: 60 * 1000,
    });
}
```

### Choosing a Strategy

| Data Changes... | Strategy                       | Example             |
| --------------- | ------------------------------ | ------------------- |
| Every tick      | Tick-based (`useTickQuery`)    | Production, storage |
| On user actions | Event-based (server emits)     | Facilities, money   |
| Never/rarely    | Static (`staleTime: Infinity`) | Game config         |

### Important: Lazy Refetching

Invalidated queries only refetch if actively being used:

- User on facilities page → refetch immediately
- User on dashboard → mark stale, no refetch
- User navigates to facilities → then refetch

This prevents wasteful network requests for data not being displayed.

## Complete Example

Adding support for `/api/v1/players/me/resources`:

### 1. Generate Types

```bash
npm run generate-types
```

### 2. Add API Method

```typescript
// src/lib/player-api.ts
export const playerApi = {
    // ... existing methods

    getResources: () =>
        apiClient.get<ApiResponse<"/api/v1/players/me/resources", "get">>(
            "/players/me/resources",
        ),
};
```

### 3. Add Query Key

```typescript
// src/lib/query-client.ts
export const queryKeys = {
    players: {
        // ... existing keys
        resources: ["players", "me", "resources"] as const,
    },
} as const;
```

### 4. Create Hook

```typescript
// src/hooks/usePlayerResources.ts
import { useQuery } from "@tanstack/react-query";
import { playerApi } from "@/lib/player-api";
import { queryKeys } from "@/lib/query-client";
import { useTickQuery } from "@/contexts/GameTickContext";

export function usePlayerResources() {
    useTickQuery(queryKeys.players.resources);

    return useQuery({
        queryKey: queryKeys.players.resources,
        queryFn: playerApi.getResources,
        staleTime: 60 * 1000,
    });
}
```

### 5. Use in Component

```typescript
// src/components/ResourceDisplay.tsx
import { usePlayerResources } from "@/hooks/usePlayerResources";

export function ResourceDisplay() {
    const { data, isLoading } = usePlayerResources();

    if (isLoading) return <div>Loading...</div>;

    return (
        <div>
            Coal: {data?.coal}
            Gas: {data?.gas}
        </div>
    );
}
```

## Mutations

For endpoints that modify data:

```typescript
// src/lib/player-api.ts
export const playerApi = {
    updateSettings: (
        data: ApiRequestBody<"/api/v1/players/me/settings", "patch">,
    ) =>
        apiClient.patch<ApiResponse<"/api/v1/players/me/settings", "patch">>(
            "/players/me/settings",
            data,
        ),
};

// src/hooks/useUpdateSettings.ts
import { useMutation } from "@tanstack/react-query";
import { playerApi } from "@/lib/player-api";
import { useGameTick } from "@/contexts/GameTickContext";

export function useUpdateSettings() {
    const { invalidateGameState } = useGameTick();

    return useMutation({
        mutationFn: playerApi.updateSettings,
        onSuccess: () => {
            invalidateGameState();
        },
    });
}
```

## Best Practices

### Query Configuration

**Tick-synced game state:**

```typescript
staleTime: 60 * 1000,      // 1 minute
gcTime: 5 * 60 * 1000,     // 5 minutes
```

**Static data:**

```typescript
staleTime: Infinity,
gcTime: Infinity,
```

**Real-time data:**

```typescript
staleTime: 0,
refetchInterval: 30 * 1000, // 30 seconds
```

### Error Handling

```typescript
const { data, isLoading, error } = usePlayerMoney();

if (error) {
    return <ErrorDisplay message={error.message} />;
}
```

### Loading States

```typescript
if (isLoading) {
    return <Skeleton />;
}

// Or inline
{isLoading ? <Skeleton /> : <DataDisplay data={data} />}
```

## Common Patterns

### Dependent Queries

```typescript
const { data: facilities } = useFacilities();
const { data: details } = useFacilityDetails(facilities?.[0]?.id, {
    enabled: !!facilities?.[0]?.id,
});
```

### Parallel Queries

```typescript
const queries = useQueries({
    queries: [
        { queryKey: queryKeys.players.money, queryFn: playerApi.getMoney },
        {
            queryKey: queryKeys.players.resources,
            queryFn: playerApi.getResources,
        },
    ],
});
```

## Troubleshooting

**Types not updating**

Run `npm run generate-types` and restart TypeScript server.

**Queries not refetching on tick**

Make sure you call `useTickQuery(queryKey)` in your hook.

**Stale data after mutation**

Call `invalidateGameState()` in mutation's `onSuccess`.

**Infinite refetch loop**

Check `staleTime` is set appropriately (60s for tick-synced data).

## See Also

- [../SOCKETIO.md](../SOCKETIO.md) - SocketIO invalidation patterns (backend)
- [FRONTEND.md](FRONTEND.md) - Foundation overview
