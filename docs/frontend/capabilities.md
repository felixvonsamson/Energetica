# Player Capabilities System

## Overview

Player capabilities are boolean flags that determine which features/pages a player has unlocked access to. These are separate from achievements (which are progress counters).

## Backend Implementation

### Schema: `PlayerCapabilities`

Location: `energetica/schemas/capabilities.py`

```python
class PlayerCapabilities(BaseModel):
    has_laboratory: bool  # Can access /technology page
    has_warehouse: bool  # Can access /resource-market
    has_storage: bool  # Can access /storage page
    has_network: bool  # Can access /network page
```

### Auth Endpoint

The capabilities are bundled with the auth response (`/api/v1/auth/me`) for efficiency:

```python
UserOut(
    id=user.id,
    username=user.username,
    role=user.role,
    player_id=user.player.id if user.player is not None else None,
    is_settled=user.player is not None,
    capabilities=PlayerCapabilities.from_player(user.player) if user.player else None,
)
```

**Size:** ~50 bytes (4 booleans + structure overhead)

## Frontend Usage

### Hook: `useCapabilities()`

```ts
import { useCapabilities, useHasCapability } from "@/hooks/useCapabilities";

// Get all capabilities
const capabilities = useCapabilities();
if (capabilities?.has_laboratory) {
    // Show research UI
}

// Check specific capability
const hasWarehouse = useHasCapability("has_warehouse");
if (!hasWarehouse) {
    return <BuildWarehousePrompt />;
}
```

### Conditional Rendering

```tsx
// Dashboard sections
{
    capabilities?.has_laboratory && (
        <DashboardSection title="🔬 Under Research" />
    );
}

// Navigation links
{
    capabilities?.has_warehouse && (
        <QuickLinkCard title="Resource Market" to="/resource-market" />
    );
}

// Beginners guide (show until network unlocked)
{
    !capabilities?.has_network && <BeginnersGuide />;
}
```

## Invalidation Strategy

Capabilities are **sent with data** (not invalidation-only) because:

- Very small (~50 bytes)
- Critical for UX (affects entire UI layout)
- Changes infrequently (only when building facilities)

### When to Invalidate

Invalidate capabilities when player builds functional facilities:

```python
# After building laboratory/warehouse/etc
player.emit("invalidate", {"queries": [["auth", "me"]]})
```

The auth query will refetch, getting updated capabilities.

## Current Status

**Implemented:**

- ✅ Backend schema (`PlayerCapabilities`)
- ✅ Auth endpoint includes capabilities
- ✅ Frontend hook (`useCapabilities`)
- ✅ Dashboard conditional rendering (laboratory, warehouse examples)

**TODO:**

- [ ] Add invalidation when building functional facilities
- [ ] Migrate all template `{% if user.achievements.X %}` checks
- [ ] Add route protection based on capabilities (e.g., `/technology` requires `has_laboratory`)
- [ ] Consider adding more capability flags as features are added

## Design Rationale

**Why separate from achievements?**

- Achievements mix two concepts: progress counters (0-N) and flags (0/1)
- Capabilities make intent clear: "can user access this feature?"
- Easier to reason about in frontend conditional rendering

**Why bundle with auth response?**

- Capabilities needed immediately on app load
- Very small data size (~50 bytes)
- No additional HTTP request needed
- Always available via `useAuth()` context

**Why not individual API endpoints?**

- Would require multiple requests
- Capabilities rarely change
- Bundling is more efficient

## See Also

- [API.md](./API.md) - Query invalidation patterns
- [SOCKETIO.md](../SOCKETIO.md) - Backend invalidation patterns
- `energetica/database/player.py` - Player achievements dict (lines 100-114)
- `energetica/templates/base.jinja` - Legacy capability checks
