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

**API Endpoints:**

- `GET /auth/me` - Get current user
- `POST /auth/login` - Login
- `POST /auth/signup` - Sign up
- `GET /logout` - Logout

## Socket.IO

Real-time connection for game ticks and live updates.

```ts
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

- Automatic JSON parsing
- Cookie credentials included
- Typed responses
- Error handling with `ApiClientError`

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

- `queryKeys.auth.me`
- `queryKeys.players.me`
- `queryKeys.facilities.all`

## Protected Routes

Route protection for different access levels.

```ts
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

```ts
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
```

## Troubleshooting

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
