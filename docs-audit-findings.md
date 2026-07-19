# docs/ Audit — Ticket #903

Audit of all 39 files under `docs/` (the ticket said ~37; actual count on disk is 39).
Each file is categorized as exactly one of: **onboarding-core**, **architecture-of-record**,
**generic-noise** (cut candidate), **wiki-territory**, **self-hosting**, or **dead-stub**.
Staleness was checked against the actual code, not just the prose.

This is INPUT to a human curation decision. It recommends; it does not decide.

## Summary — counts per category

| category | count |
|---|---|
| onboarding-core | 7 |
| architecture-of-record | 15 |
| generic-noise (cut candidate) | 8 |
| self-hosting | 2 |
| dead-stub | 7 |
| wiki-territory | 0 |
| **total** | **39** |

Notable: **no** file is player-facing wiki-territory. `frontend/wiki-pages.md` documents the
wiki *implementation* (MDX pipeline, routes), so it is architecture-of-record, not player content.

### Recommended cuts (generic-noise + dead-stubs)

Dead-stubs (empty / near-empty placeholders, safe to delete or fill):

- `docs/backend/databse.md` — 3 lines, and the filename is misspelled ("databse")
- `docs/backend/game-engine-startup.md` — 1 sentence placeholder
- `docs/game-logic/charts.md` — 2 sentences, no real content
- `docs/frontend/routing.md` — literally `TODO` + a "should have ~150 lines" note
- `docs/frontend/state-management.md` — diagram + self-admitted "missing" TODO
- `docs/frontend/component-library.md` — meta-outline of docs that "should" be written; documents none of the ~40 real UI components
- `docs/frontend/style-guide.md` — one real section + large TODO block; example uses wrong `~/` alias (repo uses `@/`)

Generic-noise (bog-standard best-practices / style-guide-not-documentation, stale-prone):

- `docs/agents/domain.md` — AI-skill plumbing, not human onboarding
- `docs/agents/issue-tracker.md` — generic `gh` CLI + skill conventions
- `docs/backend/style-guide.md` — conventions Ruff already enforces
- `docs/frontend/design-patterns.md` — generic how-to; recommends Storybook (not a dependency); opens with "TODO: rename this file"
- `docs/frontend/hooks.md` — 790 lines, Jinja-migration framing, wrong API paths (`lib/*-api.ts` vs real `lib/api/*.ts`), references dead `invalidateGameState()`
- `docs/frontend/animations.md` — generic timing/easing advice
- `docs/frontend/styling.md` — generic Tailwind guide; tells you to use `tailwind.config` which does not exist in this Tailwind v4 project; self-flags "possibly merge"
- `docs/frontend/best-practices.md` — generic React/TS patterns; stale PascalCase file-naming convention (repo is kebab-case)

### Recommended keeps (onboarding-core + architecture-of-record)

Onboarding-core:

- `docs/README.md`, `docs/getting-started/installation.md`, `docs/getting-started/local-development.md`
- `docs/game-logic/electricity-markets.md` (developer ubiquitous-language glossary)
- `docs/architecture/api.md`, `docs/architecture/overview.md`, `docs/frontend/quickstart.md`

Architecture-of-record (keep; several need a light refresh — see notes):

- All three ADRs (`0001`, `0002`, `0003`) — verified live and current
- `docs/architecture/{authentication, error-handling, lobby, real-time-sync}.md`
- `docs/backend/game-loop.md`
- `docs/frontend/{overview, capabilities, data-fetching, offline, typography, asset-colours, wiki-pages}.md`

Self-hosting (keep, but separate from onboarding):

- `docs/architecture/static-serving-and-deployment.md`, `docs/backend/incident-recovery.md`

## Per-file table

Sorted by category so cut candidates and dead-stubs group together.

| path | category | staleness note |
|---|---|---|
| docs/README.md | onboarding-core | stale: Game Logic index omits charts.md; frontend style-guide still "TODO"; does not link the (misnamed) backend database doc |
| docs/getting-started/installation.md | onboarding-core | current |
| docs/getting-started/local-development.md | onboarding-core | current (most detailed onboarding doc; scripts verified) |
| docs/game-logic/electricity-markets.md | onboarding-core | current (matches energetica/market.py vocabulary) |
| docs/architecture/api.md | onboarding-core | stale: `bun generate-types` should be `bun run generate-types`; half-written skeleton with placeholder prose |
| docs/architecture/overview.md | onboarding-core | stale: says React 18, package.json pins React 19 |
| docs/frontend/quickstart.md | onboarding-core | stale: says run `bun dev` in frontend/ (no such script; it's `dev:app`); obsolete Jinja "coexist" section |
| docs/adr/0001-action-log-stays-complete-fix-oom-on-read.md | architecture-of-record | current (read-path fix live in utils/action_log.py) |
| docs/adr/0002-server-wide-sso-shared-cookie.md | architecture-of-record | current (session.py, single-origin.ts, CI guard all present) |
| docs/adr/0003-account-creation-decoupled-from-instance-access.md | architecture-of-record | current (accounts/, lobby/, instance_membership all present) |
| docs/architecture/authentication.md | architecture-of-record | stale: still documents instance-side /auth/login /signup /change-password (moved to lobby); cookie is `energetica_session` not `session`; wrong FE filenames (kebab-case) |
| docs/architecture/error-handling.md | architecture-of-record | current (every referenced symbol verified) |
| docs/architecture/lobby.md | architecture-of-record | current (entry-gate model matches routers/auth.py + lobby.py) |
| docs/architecture/real-time-sync.md | architecture-of-record | current (Socket.IO helpers verified) |
| docs/backend/game-loop.md | architecture-of-record | stale: default tick is 30s not "every minute"; production update runs before climate events, doc has the order reversed |
| docs/frontend/overview.md | architecture-of-record | stale: import path `@/contexts/SocketContext` (real file kebab-case); frames itself as Jinja-migration scaffolding though templates/ is gone; `bun generate-types` |
| docs/frontend/capabilities.md | architecture-of-record | stale only in "See Also" legacy Jinja template references (templates/ removed); core matches schemas/capabilities.py |
| docs/frontend/data-fetching.md | architecture-of-record | mostly current; 722 lines and code-duplicating; shows `retry: 3` literal vs real retry function; kebab-case example drift |
| docs/frontend/offline.md | architecture-of-record | stale: recommends `<ConnectionStatus />` component that does not exist; config half is accurate |
| docs/frontend/typography.md | architecture-of-record | current (matches components/ui/typography.tsx) |
| docs/frontend/asset-colours.md | architecture-of-record | current (matches --asset-color-* vars in global.css); cited line numbers drifted |
| docs/frontend/wiki-pages.md | architecture-of-record | current (MDX pipeline, content/wiki/*.mdx, $slug route all verified) |
| docs/agents/domain.md | generic-noise | current but generic (AI-skill plumbing, not human onboarding) |
| docs/agents/issue-tracker.md | generic-noise | current but generic (gh CLI + skill conventions) |
| docs/backend/style-guide.md | generic-noise | current but generic (Ruff-enforced conventions) |
| docs/frontend/design-patterns.md | generic-noise | stale: recommends Storybook (not installed); "TODO: rename this file" |
| docs/frontend/hooks.md | generic-noise | stale: wrong API paths (lib/*-api.ts vs lib/api/*.ts); references non-existent invalidateGameState(); 790-line Jinja-migration how-to |
| docs/frontend/animations.md | generic-noise | current but generic (timing/easing advice) |
| docs/frontend/styling.md | generic-noise | stale: references tailwind.config (does not exist in Tailwind v4 project); self-flags "possibly merge" |
| docs/frontend/best-practices.md | generic-noise | stale: PascalCase file-naming convention (repo is kebab-case); "TODO add tooling section" |
| docs/architecture/static-serving-and-deployment.md | self-hosting | stale: "Server-Wide Accounts" section says sessions stay per-subdomain / re-enter password per instance; superseded by lobby shared-cookie SSO (ADR-0002); infra parts accurate |
| docs/backend/incident-recovery.md | self-hosting | current (checkpoint/save cadences and --load_checkpoint verified) |
| docs/backend/databse.md | dead-stub | stub (3 lines; claim accurate but too thin; filename misspelled) |
| docs/backend/game-engine-startup.md | dead-stub | stub (1 sentence placeholder) |
| docs/game-logic/charts.md | dead-stub | stub (2 sentences; real code exists in routers/charts.py + frontend charts) |
| docs/frontend/routing.md | dead-stub | stub (TODO + "should have ~150 lines") |
| docs/frontend/state-management.md | dead-stub | stub (diagram + self-admitted "missing" TODO) |
| docs/frontend/component-library.md | dead-stub | stub (outline of docs that "should" exist; documents none of ~40 real UI components) |
| docs/frontend/style-guide.md | dead-stub | stub (one real section + TODO block; wrong `~/` path alias) |

## Cross-cutting staleness drivers

1. **Completed Jinja→React migration.** `energetica/templates/` no longer exists, so every
   "legacy/coexist/migrate templates" mention (frontend overview, quickstart, capabilities,
   hooks) is dead framing.
2. **File naming moved to kebab-case repo-wide** (hooks, contexts, components). Docs that show
   `usePlayerMoney.ts` / `GameTickContext.tsx` / `PascalCase.tsx` (data-fetching, hooks,
   best-practices, overview, authentication) are nominally stale in their examples.
3. **Auth/session model moved to the lobby.** Instance-side login/signup/change-password are
   gone; the shared parent-domain `energetica_session` cookie replaced per-subdomain sessions.
   authentication.md and static-serving-and-deployment.md still describe the old model in prose.
4. **Tailwind v4 has no `tailwind.config`** — colors live in `global.css`. styling.md still
   points at the config file.
5. **Command convention** — several docs use `bun generate-types` where the repo uses
   `bun run generate-types` (api.md, frontend/overview.md).
