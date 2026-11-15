# Energetica

Web game for energy systems with a focus on electricity.

## Writing for people (GitHub, docs, code comments, commits)

Prose others read should be plain and direct. Lead with the point. Write complete,
ordinary sentences that stay concise while remaining easy to read. Prefer literal
phrasing and common words. Explain programming jargon on first use (project and domain
terms are fine). In-session conversational style is exempt.

## Stack

Backend(`src/energetica/`, `src/lobby_service/`): Python + FastAPI, an installed project (`pip install -e '.[dev]'`)
Frontend(`frontend/`): TSX + Tailwind v4 (no `tailwind.config.ts`)
Components: customised shadcn components + global stylesheet in `frontend/packages/ui` (`@energetica/ui`)
Workspaces: apps in `frontend/apps/` and shared packages in `frontend/packages/` are Bun workspaces with isolated installs; see `docs/architecture/overview.md` § Frontend
Package manager: `bun`
Project docs: `docs/README.md`

## package.json scripts

from the repo root:

- `bun run typecheck`
- `bun run format` and `bun run lint`
- `bun run generate-types`

## Python env

`.venv/bin`

### Frontend: API Types

`bun run generate-types` generates TypeScript types from each backend app's OpenAPI schema. They are the bridge for full stack type safety.

- backend: `src/energetica/freeplay/schemas/`, `src/energetica/freeplay/routers/` and `src/energetica/lobby/` are the source of truth
- one types file per app, so code only type-checks against routes its own backend serves:
  - lobby app: `frontend/apps/lobby/src/types/api.generated.ts`, consumed through `frontend/apps/lobby/src/types/api-helpers.ts`
  - workshop app: `frontend/apps/workshop/src/types/api.generated.ts`, consumed through `frontend/apps/workshop/src/types/api-helpers.ts`
  - freeplay app: `frontend/apps/freeplay/src/types/api.generated.ts`, consumed through `frontend/apps/freeplay/src/types/api-helpers.ts`
- an app imports only its own `src/` and the shared packages; lint enforces this
- code more than one app uses goes in a shared package under `frontend/packages/`
- shared packages (such as `@energetica/instance`) import API types only through the `@api` alias, with `import type`; each app that depends on such a package points `@api` at its own `api-helpers.ts`, so the package type-checks against that app's routes
- a shared package that only displays data declares the shapes it needs itself and takes no API types

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (`felixvonsamson/Energetica`) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary — label strings match the canonical role names. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` (context-indexed glossary), `docs/adr/`, and a topic-organized `docs/` tree. See `docs/agents/domain.md`.

### Code review

Greptile, an AI code reviewer, reviews each PR when it is opened. See `docs/agents/greptile.md`.
