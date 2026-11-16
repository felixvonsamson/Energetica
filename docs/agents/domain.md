# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY-MAP.md`** at the repo root — the index of the project's contexts
  (Run modes, Persistence & Replay, Accounts & users, Workshop Mode) and how they
  relate. Each context has its own `GLOSSARY.md` next to the package that owns it,
  under `backend/src/energetica/`; read the ones relevant to your topic.
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

Multi-context: a root `GLOSSARY-MAP.md`, one `GLOSSARY.md` per context beside its
package, `docs/adr/` for decisions, and a topic-organized `docs/` reference tree.

```
/
├── GLOSSARY-MAP.md
├── docs/adr/
└── backend/src/energetica/
    ├── GLOSSARY.md              ← Run modes
    ├── freeplay/GLOSSARY.md     ← Persistence & Replay
    ├── identity/GLOSSARY.md     ← Accounts & users
    └── workshop/GLOSSARY.md     ← Workshop Mode
```

Glossaries hold vocabulary only. An invariant belongs in the code it constrains, as a
docstring or comment, where someone about to break it will see it.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a
hypothesis, a test name), use the term as defined in its context's `GLOSSARY.md`. Don't drift to
synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're
inventing language the project doesn't use (reconsider) or there's a real gap (note
it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently
overriding:

> _Contradicts ADR-0007 — but worth reopening because…_
