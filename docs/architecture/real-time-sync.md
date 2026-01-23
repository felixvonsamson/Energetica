# Real-time Data Synchronization

Server maintains real-time bidirectional communication with clients via Socket.IO. Game data changes frequently (every tick, player actions), so push updates are essential.

**See also:** [Data Fetching](/docs/frontend/data-fetching.md) - TanStack Query, API client, mutation patterns

## Connection Requirements

- **Authenticated players only** (not admins)
- **Both settled and unsettled players can connect**
  - Unsettled players (choosing location) receive broadcasts (e.g., map updates)
  - Settled players receive broadcasts + player-specific events
- Uses session cookie authentication
- Multi-device support: same player can have multiple connected clients

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

## Send Data vs Invalidate

Two strategies for keeping frontend in sync:

### 1. Send Data Directly

**When:** Small data (<1KB), frequent changes, critical UX

```python
# Backend - send complete data
player.emit("worker_info", WorkersOut.from_player(player).model_dump())

# Frontend - instant update (centralized in GameTickContext)
useSocketEvent("worker_info", (data) => {
    queryClient.setQueryData(queryKeys.players.workers, data);
});
```

**Benefits:** Instant update, no HTTP round-trip, better UX

### 2. Invalidate Cache

**When:** Large data (>1KB), may not be displayed, delay acceptable

```python
# Backend - tell frontend to refetch (if needed)
player.invalidate_queries(["facilities", "all"])

# Frontend - already set up in GameTickContext
# Refetches only if query is active (component mounted)
```

**Benefits:** Efficient for large data, automatic refetch management, lazy loading

### Size Guidelines

| Size           | Strategy   | Examples                     |
| -------------- | ---------- | ---------------------------- |
| <100 bytes     | Send       | Money, workers, counters     |
| 100B - 1KB     | Send       | Player stats, small lists    |
| 1KB - 10KB     | Invalidate | Facilities, technologies     |
| >10KB          | Invalidate | Network graph, history charts |

**Rule of thumb:** If it fits in a tweet (280 bytes), send it. If unsure, invalidate.

## Implementation Patterns

### Pattern 1: Send Small Data

```python
# Backend
def update_money(self, amount: float):
    self.money = amount
    from energetica.schemas.players import MoneyOut
    self.emit("money_updated", MoneyOut.from_player(self).model_dump())
```

Frontend listeners are centralized in `GameTickContext` - no per-component code needed.

### Pattern 2: Invalidate Large Data

```python
# Backend
def build_facility(player: Player, facility_type: str):
    # ... build facility
    player.invalidate_queries(["facilities", "all"])
```

Frontend automatically refetches if query is active. **Always use `player.invalidate_queries()` or `engine.invalidate_queries()` helper methods** (not raw `emit()` calls).

### Pattern 3: Hybrid (Recommended)

Combine both: send critical small data + invalidate complex data.

```python
def build_facility(player: Player, facility_type: str):
    # ... build facility

    # Send small critical data for instant UI update
    from energetica.schemas.players import MoneyOut, WorkersOut
    player.emit("money_updated", MoneyOut.from_player(player).model_dump())
    player.emit("worker_info", WorkersOut.from_player(player).model_dump())

    # Invalidate large data (refetches only if displayed)
    player.invalidate_queries(
        ["facilities", "all"],
        ["networks", "capacities"],
    )
```

## Invalidation Helper Methods

**Always use helper methods** (not raw `emit()` calls):

```python
# Player-specific invalidation (all player's devices)
player.invalidate_queries(
    ["players", "me", "money"],
    ["facilities", "all"],
)

# Engine-wide invalidation (all connected players)
engine.invalidate_queries(["resource-market", "asks"])
```

**Benefits:** Cleaner, self-documenting, variadic arguments

### Query Keys Must Match Frontend

Backend query keys must match `frontend/src/lib/query-client.ts`:

```ts
export const queryKeys = {
    players: {
        money: ["players", "me", "money"] as const,
    },
    facilities: {
        all: ["facilities", "all"] as const,
    },
} as const;
```

### Multi-Device Sync

1. User acts on Device A
2. Backend invalidates query on **all player's devices**
3. Device A (viewing data): Refetches immediately
4. Device B (not viewing): Waits until user navigates to that page

TanStack Query only refetches if data is actively displayed.

## Common Examples

### Send Directly (Small Data)

```python
# Money (~20 bytes)
from energetica.schemas.players import MoneyOut
player.emit("money_updated", MoneyOut.from_player(player).model_dump())

# Workers (~50 bytes)
from energetica.schemas.players import WorkersOut
player.emit("worker_info", WorkersOut.from_player(player).model_dump())
```

### Invalidate (Large Data)

```python
# Facility list (100+ facilities)
player.invalidate_queries(["facilities", "all"])

# Network graph (complex topology)
player.invalidate_queries(["networks", "graph"])

# Historical charts (large time series)
player.invalidate_queries(["charts", "production"])
```

## Anti-Patterns to Avoid

```python
# ❌ BAD: Hand-crafted dicts instead of schemas
player.emit("worker_info", {"construction": {...}})

# ✅ GOOD: Use schemas (single source of truth)
from energetica.schemas.players import WorkersOut
player.emit("worker_info", WorkersOut.from_player(player).model_dump())

# ❌ BAD: Sending large data frequently
player.emit("full_state", {"money": ..., "facilities": [100+ items]})

# ✅ GOOD: Send only what changed
player.emit("money_updated", MoneyOut.from_player(player).model_dump())

# ❌ BAD: Single-device emit (breaks multi-device sync)
socketio.emit("update", data, room=request.sid)

# ✅ GOOD: All player's devices
player.emit("update", data)

# ❌ BAD: Over-broad invalidation
player.invalidate_queries(["players"], ["facilities"], ["networks"])

# ✅ GOOD: Specific invalidation
player.invalidate_queries(["facilities", "all"])
```

## Frontend Socket Listeners

**All SocketIO listeners are centralized in `GameTickContext`** - no per-component listeners needed.

```ts
// frontend/src/contexts/game-tick-context.tsx
useSocketEvent("money_updated", (data) => {
    queryClient.setQueryData(queryKeys.players.money, data);
});

useSocketEvent("invalidate", (data) => {
    data.queries.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key }),
    );
});
```

**Why centralized:**
- Listeners run globally (even when specific components unmounted)
- All socket logic in one place
- Prevents stale data from missed events

## Common Use Cases

### Actions with Multiple Effects

```python
def build_facility(player: Player, facility_type: str):
    # ... perform build
    player.money -= cost

    # Hybrid: send small critical data + invalidate large data
    from energetica.schemas.players import MoneyOut
    player.emit("money_updated", MoneyOut.from_player(player).model_dump())
    player.invalidate_queries(["facilities", "all"], ["networks", "capacities"])
```

### Tick Updates

```python
def tick():
    # ... process tick
    engine.emit("tick", {"tick": engine.total_t})
    # Don't manually invalidate - queries using useTickQuery auto-invalidate
```

### Multi-Player Actions

```python
def trade_resources(seller: Player, buyer: Player, resource: str, amount: int):
    # ... perform trade

    # Invalidate for both players
    for player in [seller, buyer]:
        player.invalidate_queries(["players", "me", "money"], ["players", "me", "resources"])
```

### Broadcast to All Players

```python
def update_resource_market():
    # ... update market

    # Broadcast to all connected players
    engine.invalidate_queries(["resource-market", "asks"])
```

## Quick Reference

| Data Size    | Strategy   | Examples                           |
| ------------ | ---------- | ---------------------------------- |
| <100 bytes   | Send       | Money, workers, counters           |
| 100B - 1KB   | Send       | Player stats, small lists          |
| 1KB - 10KB   | Invalidate | Facilities, technologies           |
| >10KB        | Invalidate | Network graph, historical charts   |

**Golden Rules:**
1. **Always use Pydantic schemas** (never hand-crafted dicts)
2. **Use helper methods** (`player.invalidate_queries()`, not raw `emit()`)
3. **Query keys must match** `frontend/src/lib/query-client.ts`
4. **When unsure, invalidate** (more efficient for large data)

## See Also

- [architecture/api.md](./api.md) - API patterns & REST endpoints
- [frontend/data-fetching.md](../frontend/data-fetching.md) - TanStack Query patterns
