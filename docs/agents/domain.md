# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the project-wide context glossary. It's
  organized into named contexts (Persistence & Replay, Electricity-market
  simulation, Accounts & users, Real-time sync, Frontend); read the sections
  relevant to your topic.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.
- **`docs/` topic tree** — deeper reference for the area you're working in:
  - `docs/architecture/` — api, authentication, error-handling, lobby, overview,
    real-time-sync, static-serving-and-deployment
  - `docs/backend/` — game loop, game-engine startup, database, incident recovery,
    style guide
  - `docs/frontend/` — routing, state management, hooks, styling, component library,
    data fetching, and more (see `docs/frontend/overview.md`)
  - `docs/game-logic/` — electricity-markets, charts
  - `docs/getting-started/` — installation, local-development
  - `docs/README.md` — index of the tree

If any of these files don't exist, **proceed silently**. Don't flag their absence;
don't suggest creating them upfront. The `/domain-modeling` skill creates them lazily
when terms or decisions actually get resolved.

## File structure

Single-context: one root `CONTEXT.md` (with per-context sections), `docs/adr/` for
decisions, and a topic-organized `docs/` reference tree.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a
hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to
synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're
inventing language the project doesn't use (reconsider) or there's a real gap (note
it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently
overriding:

> _Contradicts ADR-0007 — but worth reopening because…_
