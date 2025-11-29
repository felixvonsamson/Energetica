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
import { useAuth } from "@/hooks/useAuth";

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
import { useAuth } from "@/hooks/useAuth";
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
import { useAuth } from "@/hooks/useAuth";
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

### "ECONNREFUSED" Errors in Console

**Symptom:** Multiple ECONNREFUSED errors when dev server starts or when not logged in:

```
[vite] http proxy error: /api/v1/auth/me
AggregateError [ECONNREFUSED]
```

**Root Cause:** This is **NORMAL and EXPECTED behavior**. Here's what's happening:

1. Most game API endpoints require authentication
2. When not logged in, backend returns `303 See Other` → `/login` redirect
3. Vite proxy sees the redirect and tries to follow it
4. These requests fail because you're not authenticated yet
5. TanStack Query retries failed requests (up to 3 times with exponential backoff)

**Solution:** ✅ **This is not a bug - no action needed!**

- Backend **IS** running correctly (returning proper redirects)
- Errors are a security feature (protecting authenticated endpoints)
- They **disappear automatically** once you log in to the app
- Session cookie persists, so you only need to log in once per session

**To verify backend is working:**

```bash
# Check backend process
$ ps aux | grep uvicorn
Python ... uvicorn main:app --host 0.0.0.0 --port 5001  # ✅ Running

# Check port listener
$ lsof -i :5001
Python ... TCP *:commplex-link (LISTEN)  # ✅ Listening

# Test endpoint (expects 303 redirect when not authenticated)
$ curl -v http://localhost:5001/api/v1/weather
< HTTP/1.1 303 See Other  # ✅ Correct response
< location: /login
```

**Why so many errors?**

- Multiple queries fire on app load (auth, money, workers, resources)
- Socket.io connection attempts without auth
- Automatic retries for each failed request
- All these stop once authenticated

### Auth Not Working

- Check cookies in DevTools (Application → Cookies)
- Verify `/auth/me` endpoint returns user data when logged in
- Check CORS/credentials settings in `api-client.ts`
- Clear cookies and try logging in again
- Ensure backend session is not expired

### Socket.IO Not Connecting

- Check console for connection errors
- Verify user is authenticated (Socket.io requires auth)
- Check backend Socket.IO logs for connection attempts
- Verify WebSocket proxy in `vite.config.ts` has `ws: true`
- Check if `socket.io` path is correctly proxied

### API Types Out of Sync

**Symptom:** TypeScript errors about missing or incorrect API types

**Solution:**

```bash
# Backend must be running on port 5001
npm run generate-types

# Restart TypeScript server in your IDE
# VS Code: Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
```

### Path Aliases Not Resolving

- Restart TypeScript server in your IDE
- Check `tsconfig.json` has `paths` configured correctly
- Check `vite.config.ts` has `resolve.alias` configured
- Clear build cache: `rm -rf node_modules/.vite`
- Restart dev server

### Dev Server Won't Start

**Port already in use:**

```bash
# Find what's using the port
lsof -i :5173

# Kill the process
kill -9 <PID>

# Or let Vite find another port (it does this automatically)
```

**Module not found errors:**

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Hot Module Replacement (HMR) Not Working

- Check browser console for HMR errors
- Try hard refresh (Cmd/Ctrl + Shift + R)
- Restart dev server
- Check if file is being watched: `console.log()` in file should trigger HMR

### Production Build Issues

```bash
# Check build output
npm run build

# Check for type errors
npx tsc --noEmit

# Verify output directory
ls -la ../energetica/static/react/
```

## See Also

- [QUICKSTART.md](QUICKSTART.md) - Fast setup guide
- [API.md](API.md) - API integration & types
- [OFFLINE.md](OFFLINE.md) - Offline handling
- [../SOCKETIO.md](../SOCKETIO.md) - SocketIO patterns (backend)
