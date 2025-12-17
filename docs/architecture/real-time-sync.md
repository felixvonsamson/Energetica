# Real-time Data Synchronization

Backend patterns for SocketIO data emission and query invalidation.

See also data-fetching.md

## Core Principle: Single Source of Truth

**Never duplicate data serialization logic.** Always use Pydantic schemas.

### Bad: Duplicated Logic

```python
# In schema (players.py)
class WorkersOut(BaseModel):
    construction: WorkerInfo
    laboratory: WorkerInfo

    @classmethod
    def from_player(cls, player: Player) -> WorkersOut:
        return WorkersOut(
            construction=WorkerInfo(...),
            laboratory=WorkerInfo(...),
        )

# In player.py (DUPLICATED!)
def send_worker_info(self):
    self.emit("worker_info", {
        "construction": {...},  # Same logic, different place!
        "laboratory": {...},
    })
```

**Problems:** Bugs when formats drift, must update two places, no type safety.

### Good: Reuse Schema

```python
# In player.py
def send_worker_info(self):
    from energetica.schemas.players import WorkersOut

    data = WorkersOut.from_player(self).model_dump()
    self.emit("worker_info", data)
```

**Benefits:** Single source of truth, API and SocketIO always match, type-safe, DRY.

## Decision Matrix: Send Data vs Invalidate

### When to Send Data Directly

**Criteria:**

-   Data is small (<1KB)
-   Data changes frequently OR is critical for UX
-   You want instant updates without round-trip delay

**Example: Workers**

```python
# Backend
player.emit("worker_info", WorkersOut.from_player(player).model_dump())

# Frontend - instant update, no HTTP request
useSocketEvent("worker_info", (data) => {
    queryClient.setQueryData(queryKeys.players.workers, data);
});
```

**Size:** ~50 bytes

```json
{
    "construction": { "available": 1, "total": 1 },
    "laboratory": { "available": 0, "total": 0 }
}
```

### When to Invalidate Only

**Criteria:**

-   Data is large (>1KB, complex objects)
-   Data may not be actively displayed
-   Slight delay is acceptable

**Example: Facilities List**

```python
# Backend - just tell frontend to refetch
player.emit("invalidate", {
    "queries": [["facilities", "all"]]
})

# Frontend - refetches if query is active
useSocketEvent("invalidate", (data) => {
    data.queries.forEach(key =>
        queryClient.invalidateQueries({ queryKey: key })
    );
});
```

**Why:** Facility list could be large (100+ facilities × multiple fields).

### Size Guidelines

| Size              | Strategy   | Example                        |
| ----------------- | ---------- | ------------------------------ |
| Tiny (<100 bytes) | Send data  | Money, workers, single values  |
| Small (<1KB)      | Send data  | Player stats, small lists      |
| Medium (1-10KB)   | Depends    | Facility list, tech tree       |
| Large (>10KB)     | Invalidate | Network graph, historical data |

**Rule of thumb:** If it fits in a tweet (280 bytes), send it.

## Implementation Patterns

### Pattern 1: Simple Value Updates

**Backend:**

```python
# In player.py or wherever the value changes
def update_money(self, amount: float):
    self.money = amount

    from energetica.schemas.players import MoneyOut
    self.emit("money_updated", MoneyOut.from_player(self).model_dump())
```

**Frontend:**

```ts
// In GameTickContext.tsx (centralized listener)
useSocketEvent("money_updated", (data) => {
    queryClient.setQueryData(queryKeys.players.money, data);
});
```

**Advantages:** Instant updates, no extra HTTP request, single source of truth.

### Pattern 2: Invalidation for Complex Data

**Backend:**

```python
# In facilities.py
def build_facility(player: Player, facility_type: str):
    # ... build facility

    player.emit("invalidate", {
        "queries": [
            ["facilities", "all"],
            ["players", "me", "money"],
        ]
    })
```

**Frontend:** Already set up in GameTickContext - no extra code needed.

**Advantages:** Flexible (invalidates multiple queries), good for large/complex data, automatic refetch management.

### Pattern 3: Hybrid (Recommended)

Send critical small data + invalidate related complex data.

**Backend:**

```python
def build_facility(player: Player, facility_type: str):
    # ... build facility

    # Send small critical data directly
    from energetica.schemas.players import MoneyOut, WorkersOut
    player.emit("money_updated", MoneyOut.from_player(player).model_dump())
    player.emit("worker_info", WorkersOut.from_player(player).model_dump())

    # Invalidate complex data
    player.emit("invalidate", {
        "queries": [
            ["facilities", "all"],
            ["networks", "capacities"],
        ]
    })
```

**Why:** Money/workers update instantly (better UX), facility list only refetches if user is viewing it.

## Query Invalidation from Backend

Backend tells frontend which queries are stale. Frontend refetches them.

### Backend

```python
from energetica.database.player import Player

def build_facility(player: Player, facility_type: str):
    # ... perform the build

    # Invalidate affected queries on ALL connected devices
    player.emit("invalidate", {
        "queries": [
            ["players", "me", "money"],
            ["facilities", "all"],
            ["players", "me", "resources"],
        ]
    })
```

### Frontend

Already set up in `GameTickContext`. Query keys must match those defined in `frontend/src/lib/query-client.ts`:

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

### How It Works

1. User builds facility on Device A
2. Backend processes build, emits `"invalidate"` to all player's devices
3. Device A & Device B: Query marked stale
4. Device A (on facilities page): Immediately refetches
5. Device B (on dashboard): Waits until user navigates to facilities page

**Key:** TanStack Query only refetches if the data is actively being used.

## Common Data Types

### Send Directly

**Money:**

```python
from energetica.schemas.players import MoneyOut
player.emit("money_updated", MoneyOut.from_player(player).model_dump())
```

Size: ~20 bytes `{"money": 12345.67}`

**Workers:**

```python
from energetica.schemas.players import WorkersOut
player.emit("worker_info", WorkersOut.from_player(player).model_dump())
```

Size: ~50 bytes

**Single facility status:**

```python
from energetica.schemas.facilities import FacilityStatusOut
player.emit("facility_status", {
    "id": facility.id,
    "status": FacilityStatusOut.from_facility(facility).model_dump()
})
```

Size: ~200 bytes

### Invalidate

**Facility list:**

```python
player.emit("invalidate", {"queries": [["facilities", "all"]]})
```

Reason: Could be 100+ facilities

**Network graph:**

```python
player.emit("invalidate", {"queries": [["networks", "graph"]]})
```

Reason: Complex topology

**Historical data:**

```python
player.emit("invalidate", {"queries": [["charts", "production"]]})
```

Reason: Large time series

## Anti-Patterns

### 1. Emitting Raw Dicts Instead of Using Schemas

```python
# BAD
player.emit("worker_info", {
    "construction": {...},  # Hand-crafted
})

# GOOD
from energetica.schemas.players import WorkersOut
player.emit("worker_info", WorkersOut.from_player(player).model_dump())
```

### 2. Sending Large Data Frequently

```python
# BAD - sends entire facility list on every money change
player.emit("full_game_state", {
    "money": player.money,
    "facilities": [...],  # Large!
    "technologies": [...],  # Large!
})

# GOOD - send only what changed
from energetica.schemas.players import MoneyOut
player.emit("money_updated", MoneyOut.from_player(player).model_dump())
```

### 3. Not Handling Multi-Device Sync

```python
# BAD - only emits to current socket
socketio.emit("update", data, room=request.sid)

# GOOD - emits to all player's devices
player.emit("update", data)  # Automatically handles all connections
```

### 4. Invalidating Too Broadly

```python
# BAD - invalidates everything
player.emit("invalidate", {"queries": [["players"], ["facilities"], ["networks"]]})

# GOOD - specific invalidation
player.emit("invalidate", {"queries": [["facilities", "all"]]})
```

## Frontend Listening Patterns

### Centralized in GameTickContext

All SocketIO listeners in one place:

```ts
// src/contexts/GameTickContext.tsx
export function GameTickProvider({ children }) {
    const queryClient = useQueryClient();

    useSocketEvent("money_updated", (data) => {
        queryClient.setQueryData(queryKeys.players.money, data);
    });

    useSocketEvent("worker_info", (data) => {
        queryClient.setQueryData(queryKeys.players.workers, data);
    });

    useSocketEvent("invalidate", (data) => {
        data.queries.forEach((key) =>
            queryClient.invalidateQueries({ queryKey: key })
        );
    });
}
```

**Benefits:** All listeners in one place, works globally, runs even when component unmounted.

### Avoid: Per-Component Listeners

```ts
// BAD - listener only works when component mounted
function MoneyDisplay() {
    const queryClient = useQueryClient();

    useSocketEvent("money_updated", (data) => {
        queryClient.setQueryData(queryKeys.players.money, data);
    });
}
```

**Problem:** If component unmounts, listener stops. Data gets stale.

## Common Patterns

### Action with Multiple Effects

```python
def build_power_plant(player: Player, facility_type: str, location: tuple):
    # Deduct money
    player.money -= cost

    # Add facility
    facility = create_facility(player, facility_type, location)

    # Update capacities
    update_network_capacities(player)

    # Send money directly + invalidate the rest
    from energetica.schemas.players import MoneyOut
    player.emit("money_updated", MoneyOut.from_player(player).model_dump())
    player.emit("invalidate", {
        "queries": [
            ["facilities", "all"],
            ["facilities", "power"],
            ["networks", "capacities"],
        ]
    })
```

### Tick Updates

```python
def tick():
    # ... process tick

    # Tick event handled separately
    engine.socketio.emit("tick", {"tick": engine.total_t})

    # Don't emit invalidation for every tick - queries use useTickQuery
```

### Multi-Player Effects

```python
def trade_resources(seller: Player, buyer: Player, resource: str, amount: int):
    # Update both players
    seller.money += price
    buyer.money -= price

    # Invalidate for both players
    for player in [seller, buyer]:
        player.emit("invalidate", {
            "queries": [
                ["players", "me", "money"],
                ["players", "me", "resources"],
            ]
        })
```

## Migration Guide

If you have existing hand-crafted SocketIO emits:

### Step 1: Create Schema (if missing)

```python
# In schemas/players.py
class FacilityCountOut(BaseModel):
    power: int
    storage: int

    @classmethod
    def from_player(cls, player: Player) -> FacilityCountOut:
        return FacilityCountOut(
            power=len(player.power_facilities),
            storage=len(player.storage_facilities),
        )
```

### Step 2: Use Schema in Emit

```python
# Before
player.emit("facility_counts", {
    "power": len(player.power_facilities),
    "storage": len(player.storage_facilities),
})

# After
from energetica.schemas.players import FacilityCountOut
player.emit("facility_counts", FacilityCountOut.from_player(player).model_dump())
```

### Step 3: Update API Endpoint (if exists)

```python
@router.get("/me/facility-counts")
def get_facility_counts(
    player: Annotated[Player, Depends(get_settled_player)]
) -> FacilityCountOut:
    return FacilityCountOut.from_player(player)
```

Now API and SocketIO use identical schema.

## Summary

| Scenario           | Strategy      | Example                      |
| ------------------ | ------------- | ---------------------------- |
| Tiny data (<100B)  | Send directly | Money, workers, counters     |
| Small data (<1KB)  | Send directly | Player stats, small lists    |
| Large data (>1KB)  | Invalidate    | Facilities, network, history |
| Critical UX data   | Send directly | Money, active status         |
| Infrequent changes | Send directly | Configuration, settings      |

**Golden Rule:** Use schemas everywhere, decide send vs invalidate based on data size and UX impact.

## See Also

-   [architecture/api.md](/docs/architecture/api.md) - Frontend API integration & query invalidation
-   [frontend/data-fetching.md](/docs/frontend/data-fetching.md) - TODO
