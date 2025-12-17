# Frontend Quick Start

## Installation

```bash
cd frontend
npm install
```

## Development

### 1. Start Backend

```bash
# From project root
python main.py --env dev
```

### 2. Start Frontend

```bash
# From frontend directory
npm run dev
```

### 3. Test

Visit http://localhost:5173/app/dashboard

You should see:

-   User information
-   Socket.IO connection status
-   Tick counter incrementing every minute

## Verification

### Auth Context

Check Network tab in DevTools:

-   `GET /api/v1/auth/me` returns 200 with user data (when logged in)
-   Returns 401 when not logged in

### Socket.IO

Browser console shows:

```
Socket.IO connected
```

Backend logs show:

```
[socket.io] New connection from <username>
```

## Creating a New Page

1. Create route file:

```ts
// frontend/src/routes/app/my-page.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/app/my-page")({
    component: MyPage,
    staticData: {...}
});

function MyPage() {
    return <MyPageContent />;
}

function MyPageContent() {
    const { user } = useAuth();
    return <div>Hello {user?.username}!</div>;
}
```

2. Visit: http://localhost:5173/app/my-page

## Development Workflow

Both old and new can coexist:

-   Legacy: http://localhost:5001/dashboard (Jinja)
-   New: http://localhost:5173/app/dashboard (React)

## Quick Reference

```ts
// Auth
const { user, isAuthenticated, logout } = useAuth();

// Socket.IO
useSocketEvent("event_name", (data) => console.log(data));

// API
const data = await apiClient.get("/endpoint");

// Query
const { data } = useQuery({
    queryKey: queryKeys.players.me,
    queryFn: () => apiClient.get("/players/me"),
});

// Protected route
// TODO
// See docs/frontend/routing.md
```

## Next Steps

**Essential Reading:**

-   [best-practices.md](best-practices.md) - **Start here** for component patterns and standards
-   [styling.md](styling.md) - Tailwind patterns and theme colors
-   [animations.md](animations.md) - Animation and transition guidelines
-   [overview.md](overview.md) - Foundation documentation
-   [data-fetching.md](data-fetching.md) - API integration & types

**Learn by Example:**

-   See `src/routes/app/dashboard.tsx` for best practices in action
-   Check `src/components/ui/` for reusable components

**Reference:**

-   [capabilities.md](capabilities.md) - Feature flag system
-   [asset-colours.md](asset-colours.md) - Asset color system
