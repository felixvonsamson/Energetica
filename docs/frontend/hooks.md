# API Integration & Types

Guide for integrating backend API calls with automatic type generation.

## Quick Reference - Adding a New API Endpoint

**TL;DR - Complete workflow in 5 steps:**

1. **Generate types**: `npm run generate-types` (backend must be running on port 5001)
2. **Add API method** in `src/lib/*-api.ts`:
    ```ts
    export const myApi = {
        getData: () =>
            apiClient.get<ApiResponse<"/api/v1/path", "get">>("/path"),
    };
    ```
3. **Add query key** in `src/lib/query-client.ts`:
    ```ts
    queryKeys: {
        myFeature: {
            data: ["my-feature", "data"] as const;
        }
    }
    ```
4. **Create hook** in `src/hooks/useMyData.ts`:
    ```ts
    export function useMyData() {
        useTickQuery(queryKeys.myFeature.data); // If data changes every tick
        return useQuery({
            queryKey: queryKeys.myFeature.data,
            queryFn: myApi.getData,
            staleTime: 60 * 1000,
        });
    }
    ```
5. **Use in component**:
    ```ts
    const { data, isLoading, error } = useMyData();
    ```

**Reference implementations:** See `usePlayerMoney.ts`, `usePlayerWorkers.ts`, or `useWeather.ts` for complete examples.

---

## Creating New APIs (When None Exist)

Some legacy Jinja templates inject data directly from the server without API endpoints:

```python
# energetica/routers/templates.py
@router.get("/dashboard")
def render_dashboard(user: User):
    return templates.TemplateResponse("dashboard.jinja", {
        "user": user,
        "quiz_question": get_daily_quiz(user),  # ← Data injected here, no API!
    })
```

**When migrating these, you need to create the API first.**

### Step 1: Design the API

**Identify what data is being passed:**

```python
# In templates.py or the Jinja file
{{ quiz_question.text }}           # ← Need quiz data
{{ quiz_question.options }}        # ← Need to know structure
{{ user.has_answered_today }}      # ← Need to know if answered
```

**Design the schema:**

```python
# energetica/schemas/daily_quiz.py
from pydantic import BaseModel

class DailyQuizOut(BaseModel):
    question_id: int
    question_text: str
    options: list[str]
    has_answered_today: bool
    correct_answer_index: int | None = None  # Only if already answered
```

### Step 2: Create the Backend Endpoint

**Add router:**

```python
# energetica/routers/daily_quiz.py
from fastapi import APIRouter, Depends
from energetica.database.player import Player
from energetica.schemas.daily_quiz import DailyQuizOut
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/daily-quiz", tags=["Daily Quiz"])

@router.get("")
def get_daily_quiz(player: Annotated[Player, Depends(get_settled_player)]) -> DailyQuizOut:
    """Get today's quiz question for the player."""
    # Move logic from templates.py here
    quiz = engine.get_daily_quiz()
    has_answered = player.has_answered_quiz_today()

    return DailyQuizOut(
        question_id=quiz.id,
        question_text=quiz.text,
        options=quiz.options,
        has_answered_today=has_answered,
        correct_answer_index=quiz.correct_index if has_answered else None,
    )

@router.post("/{question_id}/answer")
def submit_quiz_answer(
    question_id: int,
    answer_index: int,
    player: Annotated[Player, Depends(get_settled_player)]
) -> dict:
    """Submit an answer to today's quiz."""
    is_correct = check_answer(question_id, answer_index)
    if is_correct:
        player.award_xp(10)
    return {"correct": is_correct, "xp_awarded": 10 if is_correct else 0}
```

**Register the router:**

```python
# energetica/routers/__init__.py
from energetica.routers import daily_quiz

app.include_router(daily_quiz.router, prefix="/api/v1")
```

### Step 3: Follow the Standard Integration Flow

Once the API exists, follow the [Quick Reference](#quick-reference---adding-a-new-api-endpoint) workflow above.

### Step 4: Handle Mutations

If the feature requires POST/PUT/DELETE (like submitting a quiz answer):

```ts
// src/lib/daily-quiz-api.ts
export const dailyQuizApi = {
    getToday: () =>
        apiClient.get<ApiResponse<"/api/v1/daily-quiz", "get">>("/daily-quiz"),

    submitAnswer: (questionId: number, answerIndex: number) =>
        apiClient.post<
            ApiResponse<"/api/v1/daily-quiz/{question_id}/answer", "post">
        >(`/daily-quiz/${questionId}/answer`, { answer_index: answerIndex }),
};

// src/hooks/useDailyQuiz.ts
export function useSubmitQuizAnswer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            questionId,
            answerIndex,
        }: {
            questionId: number;
            answerIndex: number;
        }) => dailyQuizApi.submitAnswer(questionId, answerIndex),
        onSuccess: () => {
            // Invalidate to refetch with new state
            queryClient.invalidateQueries({
                queryKey: queryKeys.dailyQuiz.today,
            });
        },
    });
}
```

### Common Patterns to Extract

| Template Injection             | API Approach                   | Notes              |
| ------------------------------ | ------------------------------ | ------------------ |
| `{{ user.money }}`             | `GET /api/v1/players/me/money` | User-specific data |
| `{{ config.MAX_WORKERS }}`     | `GET /api/v1/config/constants` | Static config      |
| `{{ facilities }}`             | `GET /api/v1/facilities`       | Lists of data      |
| `{% if user.achievements.x %}` | Include in user object         | Achievements/flags |
| `{{ form_data }}`              | POST endpoint with body        | Forms/mutations    |

### Migration Strategy for Server-Injected Data

**Option A: Create API immediately** (Recommended)

1. Extract logic from template rendering
2. Create proper schema and endpoint
3. Migrate to React with API calls
4. Better separation of concerns

**Option B: Temporary hybrid approach**

1. Keep template injection temporarily
2. Pass data via `window.__INITIAL_DATA__`
3. Migrate in phases
4. Create API later

**Example of Option B (NOT RECOMMENDED except for quick prototyping):**

```python
# templates.py
return templates.TemplateResponse("dashboard.jinja", {
    "initial_data": json.dumps({"quiz": quiz_data}),
})
```

```html
<!-- dashboard.jinja -->
<script>
    window.__INITIAL_DATA__ = {{ initial_data | safe }};
</script>
```

```ts
// React component
const initialData = (window as any).__INITIAL_DATA__;
```

⚠️ **This approach is discouraged** because:

-   Loses benefits of React SPA (no data refresh)
-   Harder to maintain
-   Mixing rendering paradigms
-   Defeats purpose of migration

**Always prefer creating proper APIs (Option A).**

---

## Migrating from Legacy Jinja Templates

Most development time will be spent converting existing Jinja templates to React. Here's the systematic approach:

### Step 1: Locate the Legacy Implementation

**Find the related files:**

```bash
# Template file (UI structure)
energetica/templates/[page-name].jinja

# JavaScript file (API calls, logic)
energetica/static/[page-name].js

# Python router (backend endpoint)
energetica/routers/[feature].py

# Schema (data structure)
energetica/schemas/[feature].py
```

**Example - Dashboard weather section:**

-   Template: `energetica/templates/dashboard.jinja` (lines 45-50)
-   JavaScript: `energetica/static/dashboard.js` (complete implementation)
-   Router: `energetica/routers/weather.py`
-   Schema: `energetica/schemas/weather.py`

### Step 2: Analyze the Legacy Behaviour

**Check the JavaScript for:**

-   API endpoint it calls (e.g., `fetch("/api/v1/weather")`)
-   Data transformation logic (e.g., `Math.round(data.value)`)
-   Visual behaviour (e.g., progress bars, calculations)
-   Update frequency (e.g., Socket.io listeners, interval polling)

**Check the Jinja template for:**

-   DOM structure and styling
-   Conditional rendering (e.g., `{% if user.achievements.network %}`)
-   Server-side data passed in (e.g., `{{ user.username }}`)

**Example from `dashboard.js`:**

```javascript
// This tells us:
// 1. Endpoint: /api/v1/weather
// 2. Fields: month_number, year_progress, solar_irradiance, wind_speed, river_discharge
// 3. Calculations: irradiance/1000, wind_speed/60, river_discharge/150
// 4. Display: Progress bars with specific widths
fetch("/api/v1/weather")
    .then((response) => response.json())
    .then((weather_data) => {
        // ... implementation shows visual requirements
    });
```

### Step 3: Implement in React

Follow the Quick Reference workflow above, but **match the legacy behaviour:**

1. **Use the same API endpoint** (ensure backend compatibility)
2. **Match the visual appearance** (progress bars, colors, layout)
3. **Preserve the same calculations** (e.g., `Math.round()`, division factors)
4. **Keep the same update pattern** (tick-based, event-based, or static)

**Example comparison:**

```javascript
// Legacy (dashboard.js)
const month_name = ["January", "February", ...][weather_data.month_number - 1];
weather_conditions.innerHTML = `<div>Month: <b>${month_name}</b></div>`;
```

```ts
// React (dashboard.tsx)
import { getMonthName } from "@/lib/date-utils"; // Extracted to utility
<div>
    Month: <b>{getMonthName(weatherData.month_number)}</b>
</div>;
```

### Step 4: Extract Reusable Logic

When you encounter duplicated logic (like month names), **extract to utilities:**

```ts
// src/lib/date-utils.ts
export function getMonthName(monthNumber: number): string {
    return MONTH_NAMES[monthNumber - 1] || "Unknown";
}
```

This solves TODOs from legacy code (e.g., the "move month list to separate file" comment in `dashboard.js:8`).

### Step 5: Test Against Legacy

**Visual parity checklist:**

-   [ ] Same data displayed
-   [ ] Same layout and spacing
-   [ ] Same colors and styling
-   [ ] Same responsive behaviour
-   [ ] Same calculations and rounding
-   [ ] Proper loading and error states (legacy often lacks these!)

**Improvements you can add:**

-   ✨ Dark mode support
-   ✨ Smooth transitions
-   ✨ Better responsive design
-   ✨ Proper error boundaries
-   ✨ Loading skeletons

**Example - Weather section improvements:**

-   Legacy: No loading state, no dark mode
-   React: Loading spinner, dark mode bars, smooth transitions, responsive grid

### Common Migration Patterns

| Legacy Pattern                         | React Equivalent                    | Notes                                    |
| -------------------------------------- | ----------------------------------- | ---------------------------------------- |
| `fetch("/api/...").then(...)`          | `useQuery({ queryFn: api.get... })` | Automatic caching, retry, error handling |
| `setInterval(() => fetch(...), 60000)` | `useTickQuery(queryKey)`            | Syncs with game ticks                    |
| `socket.on("update", ...)`             | Automatic via `invalidate` events   | No code needed in hook                   |
| `element.innerHTML = ...`              | JSX components                      | Type-safe, reusable                      |
| `{% if condition %}`                   | `{condition && <Component />}`      | Client-side rendering                    |
| `{{ variable }}`                       | `{variable}`                        | Must come from API, not server           |

### Authentication Requirements

Most game endpoints require authentication:

```bash
# Unauthenticated request
$ curl http://localhost:5001/api/v1/weather
< HTTP/1.1 303 See Other
< location: /login
```

**What this means:**

-   ✅ **Backend is working correctly** - it redirects to login
-   ✅ **ECONNREFUSED errors in console are normal** when not logged in
-   ✅ **Errors disappear after authentication** - this is expected behaviour
-   ❌ **Don't try to "fix" these errors** - they're a security feature

**During development:**

1. Log in to the app once
2. Session cookie persists
3. All API calls work normally
4. Background errors stop appearing

---

## Type Generation

Types are automatically generated from the FastAPI OpenAPI schema.

### Generate Types

```bash
# Backend must be running at http://localhost:5001
npm run generate-types
```

This creates `src/types/api.generated.ts` with all API types.

### Using Generated Types

```ts
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

-   Backend API endpoints change
-   Request/response schemas change
-   After pulling backend changes
-   Before committing frontend changes

## API Client Structure

Organize API calls into modules in `src/lib/`:

```ts
// src/lib/player-api.ts
import { apiClient } from "@/lib/api-client";
import type { ApiResponse, ApiRequestBody } from "@/types/api-helpers";

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

## Query Integration

### Query Keys

Define in `src/lib/query-client.ts`:

```ts
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

```ts
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

```ts
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

```ts
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

-   User on facilities page → refetch immediately
-   User on dashboard → mark stale, no refetch
-   User navigates to facilities → then refetch

This prevents wasteful network requests for data not being displayed.

## Complete Example

Adding support for `/api/v1/players/me/resources`:

### 1. Generate Types

```bash
npm run generate-types
```

### 2. Add API Method

```ts
// src/lib/player-api.ts
export const playerApi = {
    // ... existing methods

    getResources: () =>
        apiClient.get<ApiResponse<"/api/v1/players/me/resources", "get">>(
            "/players/me/resources"
        ),
};
```

### 3. Add Query Key

```ts
// src/lib/query-client.ts
export const queryKeys = {
    players: {
        // ... existing keys
        resources: ["players", "me", "resources"] as const,
    },
} as const;
```

### 4. Create Hook

```ts
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

```ts
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

For endpoints that modify data (POST, PUT, PATCH, DELETE):

```ts
// src/lib/player-api.ts
export const playerApi = {
    updateSettings: (
        data: ApiRequestBody<"/api/v1/players/me/settings", "patch">
    ) =>
        apiClient.patch<ApiResponse<"/api/v1/players/me/settings", "patch">>(
            "/players/me/settings",
            data
        ),
};

// src/hooks/useUpdateSettings.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { playerApi } from "@/lib/player-api";
import { queryKeys } from "@/lib/query-client";

export function useUpdateSettings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: playerApi.updateSettings,
        onSuccess: () => {
            // Invalidate specific queries that depend on this data
            queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
        },
    });
}
```

**Reference implementation:** See `useAuthQueries.ts` for authentication mutations, `useDailyQuiz.ts` for quiz submission, or `useFacilities.ts` for facility operations.

### Mutation Best Practices

1. **Always use `useQueryClient()`** - Import and use the query client to invalidate queries after successful mutations
2. **Invalidate specific queries** - Call `queryClient.invalidateQueries({ queryKey: ... })` with the specific keys that need to be refetched
3. **Invalidate multiple queries if needed** - A single mutation might affect multiple parts of the UI:
    ```ts
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.facilities.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.players.money });
    };
    ```
4. **Use `setQueryData` for direct updates** - When the mutation response contains the updated data, you can update the cache directly instead of invalidating:
    ```ts
    onSuccess: (data) => {
        queryClient.setQueryData(queryKeys.dailyQuiz.today, data);
    };
    ```
5. **Rely on server-driven invalidation when possible** - For complex state changes, the backend can emit `invalidate` events that automatically handle cache invalidation

## Best Practices

### Query Configuration

**Tick-synced game state:**

```ts
staleTime: 60 * 1000,      // 1 minute
gcTime: 5 * 60 * 1000,     // 5 minutes
```

**Static data:**

```ts
staleTime: Infinity,
gcTime: Infinity,
```

**Real-time data:**

```ts
staleTime: 0,
refetchInterval: 30 * 1000, // 30 seconds
```

### Error Handling

```ts
const { data, isLoading, error } = usePlayerMoney();

if (error) {
    return <ErrorDisplay message={error.message} />;
}
```

### Loading States

```ts
if (isLoading) {
    return <Skeleton />;
}

// Or inline
{
    isLoading ? <Skeleton /> : <DataDisplay data={data} />;
}
```

## Common Patterns

### Dependent Queries

```ts
const { data: facilities } = useFacilities();
const { data: details } = useFacilityDetails(facilities?.[0]?.id, {
    enabled: !!facilities?.[0]?.id,
});
```

### Parallel Queries

```ts
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

-   [Real-time Synchronisation](architecture/real-time-sync.md) - SocketIO invalidation patterns (backend)
-   [overview.md](overview.md) - Foundation overview
