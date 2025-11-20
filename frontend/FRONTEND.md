# Frontend Foundation

React foundation for the Jinja → React migration.

## Overview

The frontend uses:

- React with TypeScript
- TanStack Router for routing
- TanStack Query for data fetching
- Socket.IO for real-time updates
- Cookie-based authentication
- Type-safe API client with OpenAPI type generation

## Architecture

```
Application Root (QueryClientProvider)
  └─ AuthProvider (user state & cookies)
      └─ SocketProvider (WebSocket connection)
          └─ GameTickProvider (tick synchronization)
              └─ RouterProvider (TanStack Router)
                  └─ Your Components
```

## File Structure

```
frontend/src/
├── components/
│   └── auth/
│       └── ProtectedRoute.tsx      # Route protection
├── contexts/
│   ├── AuthContext.tsx             # Authentication state
│   ├── SocketContext.tsx           # Socket.IO connection
│   └── GameTickContext.tsx         # Tick synchronization
├── hooks/
│   ├── useAuthQueries.ts           # Auth mutations
│   └── use*.ts                     # Custom query hooks
├── lib/
│   ├── api-client.ts               # HTTP client
│   ├── query-client.ts             # TanStack Query config
│   └── *-api.ts                    # API method modules
├── types/
│   ├── api.generated.ts            # Generated API types
│   └── api-helpers.ts              # Type utilities
└── routes/
    └── app/
        └── *.tsx                    # Route files
```

## Authentication

Cookie-based auth that reads existing session cookies.

```typescript
import { useAuth } from "@/contexts/AuthContext";

function MyComponent() {
    const { user, isAuthenticated, isLoading, logout } = useAuth();

    if (isLoading) return <div>Loading...</div>;
    if (!isAuthenticated) return <div>Not logged in</div>;

    return (
        <div>
            <h1>Welcome, {user.username}!</h1>
            <button onClick={logout}>Logout</button>
        </div>
    );
}
```

**API Endpoints:**

- `GET /auth/me` - Get current user
- `POST /auth/login` - Login
- `POST /auth/signup` - Sign up
- `GET /logout` - Logout

## Socket.IO

Real-time connection for game ticks and live updates.

```typescript
import { useSocket, useSocketEvent } from "@/contexts/SocketContext";

function GameComponent() {
    const { isConnected } = useSocket();

    useSocketEvent("tick", (data) => {
        console.log("Game tick:", data);
    });

    return <div>Connected: {isConnected ? "Yes" : "No"}</div>;
}
```

**Available Hooks:**

- `useSocket()` - Socket instance and connection status
- `useSocketEvent(event, handler)` - Listen to events (auto cleanup)

## API Client

Type-safe HTTP requests with automatic error handling.

```typescript
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

- Automatic JSON parsing
- Cookie credentials included
- Typed responses
- Error handling with `ApiClientError`

## TanStack Query

Pre-configured query client for data fetching and caching.

```typescript
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

- `queryKeys.auth.me`
- `queryKeys.players.me`
- `queryKeys.facilities.all`

## Protected Routes

Route protection for different access levels.

```typescript
import {
    ProtectedRoute,
    RequireSettledPlayer,
    RequireAdmin,
    PublicOnlyRoute,
} from "@/components/auth/ProtectedRoute";

// Require authentication
<ProtectedRoute>
    <MyComponent />
</ProtectedRoute>

// Require settled player
<RequireSettledPlayer>
    <GamePage />
</RequireSettledPlayer>

// Admin only
<RequireAdmin>
    <AdminDashboard />
</RequireAdmin>

// Public only (redirect if logged in)
<PublicOnlyRoute>
    <LoginPage />
</PublicOnlyRoute>
```

## Path Aliases

Clean imports using `@` prefix.

```typescript
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api-client";
```

**Available aliases:**

- `@/*` - src root
- `@components/*` - components
- `@hooks/*` - hooks
- `@lib/*` - lib
- `@contexts/*` - contexts
- `@types/*` - types

## Migration Strategy: `/app/*` Routes

New React pages are served under `/app/*` for gradual migration.

### Backend Setup

Backend serves React SPA for all `/app/*` paths:

```python
# energetica/routers/templates.py
@router.get("/app/{full_path:path}")
def render_react_app(...):
    return FileResponse("energetica/static/react/index.html")
```

### Migration Process

1. Build new page at `/app/dashboard`

```typescript
// frontend/src/routes/app/dashboard.tsx
export const Route = createFileRoute("/app/dashboard")({
    component: DashboardPage,
});
```

2. Test thoroughly at `http://localhost:5173/app/dashboard`

3. Deploy side-by-side (old Jinja at `/dashboard`, new React at `/app/dashboard`)

4. Redirect when ready

```python
@router.get("/dashboard")
def old_dashboard(...):
    return RedirectResponse("/app/dashboard")
```

## Complete Example

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useSocketEvent } from "@/contexts/SocketContext";
import { useQuery } from "@tanstack/react-query";
import { RequireSettledPlayer } from "@/components/auth/ProtectedRoute";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";

export const Route = createFileRoute("/app/my-page")({
    component: MyPage,
});

function MyPage() {
    return (
        <RequireSettledPlayer>
            <MyPageContent />
        </RequireSettledPlayer>
    );
}

function MyPageContent() {
    const { user } = useAuth();

    const { data, isLoading } = useQuery({
        queryKey: queryKeys.players.money,
        queryFn: () => apiClient.get("/players/me/money"),
    });

    useSocketEvent("money_update", (newMoney) => {
        console.log("Money updated:", newMoney);
    });

    if (isLoading) return <div>Loading...</div>;

    return (
        <div>
            <h1>Hello, {user?.username}!</h1>
            <p>Money: {data.money}</p>
        </div>
    );
}
```

## Troubleshooting

**Auth not working?**

- Check cookies in DevTools
- Verify `/auth/me` endpoint returns user
- Check CORS/credentials settings

**Socket.IO not connecting?**

- Check console for connection errors
- Verify user is authenticated
- Check backend Socket.IO logs

**Path aliases not resolving?**

- Restart TypeScript server
- Check `tsconfig.json` and `vite.config.ts`
- Clear build cache: `rm -rf node_modules/.vite`

## See Also

- [QUICKSTART.md](QUICKSTART.md) - Fast setup guide
- [API.md](API.md) - API integration & types
- [OFFLINE.md](OFFLINE.md) - Offline handling
- [../SOCKETIO.md](../SOCKETIO.md) - SocketIO patterns (backend)
