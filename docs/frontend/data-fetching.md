# Data fetching

## TanStack Query

Pre-configured query client for data fetching and caching.

```ts
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { apiClient } from "@/lib/api-client";

// Query
function usePlayerData() {
    return useQuery({
        queryKey: queryKeys.players.me,
        queryFn: () => apiClient.get("/players/me"),
    });
}

// Mutation
function useUpdateSettings() {
    return useMutation({
        mutationFn: (data) => apiClient.patch("/players/me/settings", data),
    });
}
```

**Query Keys** (defined in `lib/query-client.ts`):

-   `queryKeys.auth.me`
-   `queryKeys.players.me`
-   `queryKeys.facilities.all`

## API Client

Type-safe HTTP requests with automatic error handling.

```ts
import { apiClient } from "@/lib/api-client";

// GET request
const data = await apiClient.get<MyType>("/endpoint");

// POST request
const result = await apiClient.post("/endpoint", { key: "value" });

// With query params
const data = await apiClient.get("/endpoint", {
    params: { page: 1, limit: 10 },
});
```

**Features:**

-   Automatic JSON parsing
-   Cookie credentials included
-   Typed responses
-   Error handling with `ApiClientError`

## TODO

**Missing sections:**

-   Detailed Query pattern examples (beyond basic code snippet)
-   Mutation patterns with error handling
-   Query invalidation strategies
-   useTickQuery pattern explanation
-   Common patterns table
-   Troubleshooting section

**Note:** This was likely truncated from the original `API.md` (which was ~750 lines). Consider adding the missing content back.
