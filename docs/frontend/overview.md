# Frontend Foundation

See [architecture/overview.md](../architecture/overview.md)

React foundation for the Jinja → React migration.

## Overview

The frontend uses:

-   React with TypeScript
-   TanStack Router for routing
-   TanStack Query for data fetching
-   Socket.IO for real-time updates
-   Cookie-based authentication
-   Type-safe API client with OpenAPI type generation

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

-   `useSocket()` - Socket instance and connection status
-   `useSocketEvent(event, handler)` - Listen to events (auto cleanup)

## Protected Routes

Route protection for different access levels: done with staticData, see tanstack router.

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

-   Check browser console for HMR errors
-   Try hard refresh (Cmd/Ctrl + Shift + R)
-   Restart dev server
-   Check if file is being watched: `console.log()` in file should trigger HMR

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

-   [quickstart.md](quickstart.md) - Fast setup guide
-   [data-fetching.md](data-fetching.md) - API integration & types
-   [offline.md](offline.md) - Offline handling
-   [Real-time Synchronisation](architecture/real-time-sync.md) - SocketIO patterns (backend)
