# Offline Resilience

How the app handles spotty connections, server downtime, and offline scenarios.

## The Problem

Mobile users on 4G/5G experience:

- Intermittent connectivity (tunnels, rural areas, network switching)
- Temporary server unavailability (restarts, maintenance)
- Slow/unreliable connections (high latency, packet loss)

## Default Behavior

When connection is lost:

1. SocketIO disconnects (no tick events)
2. Queries become stale after `staleTime` (60s for game data)
3. Refetch attempts fail (network error)
4. TanStack Query retries with exponential backoff (1s, 2s, 4s)
5. After 3 failed attempts, query enters error state
6. **Stale data remains available** in cache

### Key Insight: Data Doesn't Disappear

```typescript
const { data, error, isError } = usePlayerMoney();

// Connection failed
// data still has last successful value
// error has network error
// isError = true
```

## Configuration

### Query Client

```typescript
queries: {
    // Retry with exponential backoff: 1s, 2s, 4s
    retry: (failureCount, error) => {
        // Don't retry client errors (401, 404, etc.)
        if (status >= 400 && status < 500) return false;
        // Retry network errors up to 3 times
        return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Auto-refetch when connection restored
    refetchOnReconnect: true,

    // Only fetch when online
    networkMode: 'online',
}
```

### SocketIO

SocketIO has built-in reconnection:

- Automatically tries to reconnect on disconnect
- Uses exponential backoff
- Emits `connect` event when successful

## Recommended UX Patterns

### Global Connection Banner

Shows at top of app when disconnected.

```typescript
import { ConnectionStatus } from "@/components/ConnectionStatus";

export function RootLayout() {
    return (
        <>
            <ConnectionStatus />
            <TopBar />
            <main>...</main>
        </>
    );
}
```

**States:**

- Connection lost: "Connection lost. Showing cached data."
- Cannot connect: "Cannot connect to server."
- Reconnected: "Reconnected! Your data is up to date." (auto-hides after 3s)

### Inline Error Indicators

Show subtle indicators on specific data that failed to update.

```typescript
const { data, isError, error } = usePlayerMoney();

<div className="relative">
    {isError && (
        <span className="absolute -top-1 -right-1 text-xs text-red-600">
            <i className="fa fa-exclamation-circle"></i>
        </span>
    )}
    <span className={isError ? "opacity-75" : ""}>
        ${data?.money ?? 0}
    </span>
</div>
```

### Disable Actions When Offline

Prevent desyncs by blocking mutations while disconnected.

```typescript
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

function BuildFacilityButton() {
    const { canPerformActions } = useOnlineStatus();
    const buildMutation = useBuildFacility();

    return (
        <button
            onClick={() => buildMutation.mutate(...)}
            disabled={!canPerformActions || buildMutation.isPending}
            title={!canPerformActions ? "Action disabled - no connection" : ""}
        >
            Build Facility
        </button>
    );
}
```

**Status checks:**

- `isOnline`: Browser's `navigator.onLine` (has internet)
- `isConnected`: SocketIO is connected to server
- `canPerformActions`: Both true (safe to mutate)

## Behavior Scenarios

### Scenario 1: User Loses Connection Mid-Session

```
T+0s:  Connection drops
       → SocketIO: "Disconnected"
       → Banner: "Connection lost. Showing cached data."
       → Mutations: Disabled

T+30s: User navigates to facilities page
       → Query tries to refetch (stale)
       → Fails (no connection)
       → Shows stale facility list + error indicator

T+60s: Connection restored
       → SocketIO: "Connected"
       → Banner: "Reconnected!" (3s)
       → All active queries: Auto-refetch
       → Mutations: Re-enabled
```

### Scenario 2: Server Restarts (30s downtime)

```
T+0s:  Server down
       → SocketIO: "Disconnected"
       → Queries continue using cached data

T+10s: User tries to build facility
       → Button disabled (no connection)

T+30s: Server up
       → SocketIO: Auto-reconnects
       → Tick event received
       → All tick-registered queries: Auto-refetch
```

### Scenario 3: Spotty 4G (Intermittent Drops)

```
T+0s:  Connection drops
       → TanStack Query: Retry #1 after 1s
T+1s:  Retry #1 fails
       → Retry #2 after 2s
T+3s:  Connection back
       → Retry #2 succeeds
       → User never saw error (seamless)
```

**If connection stays down:**

```
T+0s:  Connection drops
T+1s:  Retry #1 fails
T+3s:  Retry #2 fails
T+7s:  Retry #3 fails
       → Query enters error state
       → Shows stale data + error indicator
```

## When to Show What

| State                    | Display                      |
| ------------------------ | ---------------------------- |
| Initial load             | Skeleton/spinner             |
| Success                  | Data                         |
| Refetching in background | Data + subtle spinner        |
| Error, no stale data     | Error message + retry button |
| Error, has stale data    | Stale data + indicator       |
| Offline (global)         | Banner at top                |

## Testing

### Chrome DevTools

1. Open DevTools → Network tab
2. Throttling dropdown → "Offline"
3. Verify "Connection lost" banner appears
4. Re-enable → "Reconnected!" banner
5. Verify queries refetch

### Checklist

- Connection lost banner appears
- Stale data still visible
- Mutations disabled (buttons grayed out)
- Reconnect banner appears when back online
- Data refreshes automatically
- No console errors during offline period

## Recommendations

**Do:**

- Show stale data with error indicator
- Display global connection status banner
- Disable mutations when offline
- Auto-refetch on reconnect
- Use exponential backoff for retries

**Don't:**

- Show blank screens when offline
- Allow mutations while disconnected (causes desyncs)
- Retry indefinitely (wastes battery/data)
- Hide connection status (confuses users)

## Configuration Trade-offs

| Setting                    | Current                | Alternative | Trade-off                               |
| -------------------------- | ---------------------- | ----------- | --------------------------------------- |
| `retry: 3`                 | 3 retries              | `retry: 0`  | More resilient vs faster error feedback |
| `networkMode: 'online'`    | Only fetch when online | `'always'`  | Clean errors vs trying anyway           |
| `refetchOnReconnect: true` | Auto-refetch           | `false`     | Fresh data vs saving bandwidth          |
| `staleTime: 60s`           | 1 minute               | `5 * 60s`   | More requests vs fresher data           |

Current settings optimize for mobile users with intermittent connections while maintaining data freshness for the game.
