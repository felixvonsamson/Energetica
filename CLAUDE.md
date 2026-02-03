# Energetica

Web game for energy systems with a focus on electricity.

## Stack

Backend(`energetica/`): Python + FastAPI backend
Frontend(`frontend/`): TSX + Tailwind v4 (no `tailwind.config.ts`)
Components: customised shadcn component + `frontend/src/styles/global.css`
Package manager: `bun`
Project docs: `docs/README.md`
Deprecated Frontend: Deprecated Jinja `energetica/templates/`

## package.json scripts

- `bun run typecheck`
- `bun run lint`
- `bun run generate-types`

### Frontend: API Types

`bun run generate-types` creates `frontend/src/types/api.generated.ts` is the bridge for full stack type safety.

- backend: `energetica/schemas/` and `energetica/routers/` are the source of truth
- frontend: `frontend/src/types/api-helpers.ts` for consuming types
