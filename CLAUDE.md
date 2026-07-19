# Energetica

Web game for energy systems with a focus on electricity.

## Writing for people (GitHub, docs, code comments, commits)

Prose others read should be plain and direct. Lead with the point. Write complete,
ordinary sentences that stay concise while remaining easy to read. Prefer literal
phrasing and common words. Explain programming jargon on first use (project and domain
terms are fine). In-session conversational style is exempt.

## Stack

Backend(`energetica/`): Python + FastAPI backend
Frontend(`frontend/`): TSX + Tailwind v4 (no `tailwind.config.ts`)
Components: customised shadcn component + `frontend/src/styles/global.css`
Package manager: `bun`
Project docs: `docs/README.md`
Deprecated Frontend: Deprecated Jinja `energetica/templates/`

## package.json scripts

- `bun run typecheck` 
- `bun run format` and `bun run lint` - run both before committing
- `bun run generate-types`

## Python env

`.venv/bin`

### Frontend: API Types

`bun run generate-types` creates `frontend/src/types/api.generated.ts` is the bridge for full stack type safety.

- backend: `energetica/schemas/` and `energetica/routers/` are the source of truth
- frontend: `frontend/src/types/api-helpers.ts` for consuming types

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (`felixvonsamson/Energetica`) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: root `CONTEXT.md` (context-indexed glossary), `docs/adr/`, and a topic-organized `docs/` tree. See `docs/agents/domain.md`.
