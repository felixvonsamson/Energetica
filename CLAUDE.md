# Energetica

Web game for energy systems with a focus on electricity.

**Stack:** Python/FastAPI backend (`energetica/`), TypeScript/React frontend (`frontend/`)
**Package manager:** `bun`
**Docs:** See `docs/` (indexed in `docs/README.md`)

## Essential Commands

- `bun run generate-types` - **Run after backend schema changes** (generates TS types from OpenAPI)
- `bun run dev` - Start frontend dev server (Tailwind v4)
- `bun run lint:check` - ESLint
- `bun run tsc:check` - TypeScript type checking

---

## Critical Patterns

### Frontend: Query Key Management

**NEVER hardcode TanStack Query keys.** Centralized in `frontend/src/lib/query-client.ts`.

```ts
// ✅ Correct
import { queryKeys } from "@/lib/query-client";
queryClient.invalidateQueries({ queryKey: queryKeys.facilities.all });

// ❌ Wrong
queryClient.invalidateQueries({ queryKey: ["facilities", "all"] });
```

### Frontend: UI Components & Styling

**When editing frontend code, prefer modern patterns even if the file uses legacy code:**

- Use shadcn components (`frontend/src/components/ui/`) instead of raw HTML elements
- Use semantic color classes (defined in `frontend/src/styles/global.css`) instead of `dark:` modifiers
- Use utility components for consistency:
    - `frontend/src/lib/format-utils.ts` for number formatting
    - `frontend/src/components/ui/money.tsx` for currency
    - `frontend/src/components/ui/asset-name.tsx` for facility/technology names
    - Lucide icons: `import { DollarSign } from "lucide-react"`

**Imports:** Use fully qualified `@/` imports (not `index.ts` barrel exports)

### Frontend: API Types

Types are auto-generated from OpenAPI: `frontend/src/types/api.generated.ts` which is 8k lines long. Avoid reading directly. Suggested to read backend schemas (`energetica/schemas/`) or routers (`energetica/routers/`) instead.

**NEVER hardcode API types.** Use `frontend/src/types/api-helpers.ts` to derive types programmatically instead of hardcoding.

```ts
import { ApiSchema } from "@/types/api-helpers";

export type ElectricityMarket = ApiSchema<"ElectricityMarketOut">;
```

### Backend: API Design (AIP-136)

Use POST with verb suffixes for actions:

```python
@router.post("/asks/{ask_id}:purchase")
@router.post("/facilities/{facility_id}:start")
```

### Backend: Pickle Compatibility

Classes inheriting from `DBModel` are serialized as pickle files. When modifying data structures, ensure backward compatibility by setting sensible defaults in `__setstate__`.

### Real-time Sync: Cache Invalidation

Backend invalidates frontend cache via Socket.IO, using the **same query keys** as `frontend/src/lib/query-client.ts`:

```python
player.emit("invalidate", {
    "queries": [
        ["facilities", "all"],
        ["networks", "capacities"],
    ]
})
```

---

## Reference

**Jinja → React migrations:** Use `energetica/templates/` for layout/content reference (aim for feature parity)

**Example locations:**

- Frontend patterns: `frontend/src/contexts/`, `frontend/src/hooks/`, `frontend/src/lib/`
- Backend examples: `energetica/routers/projects.py`, `energetica/schemas/projects.py`
- UI component example: `frontend/src/components/electricity-markets/market-detail-modal.tsx`
