# Energetica Style Guide

Complement to linter enforcement (Ruff + tooling). When in doubt: optimize for clarity & testability.

## Python
- Target: 3.12 (compatible with 3.11 where feasible)
- Imports: standard lib, third-party, local (newline separated)
- Line length: 120
- Type hints: required for public functions & dataclasses; internal helpers may omit trivial types.
- Docstrings:
  - One-liner fits on single line including quotes.
  - Multi-line form: opening & closing triple quotes on their own lines.
- Prefer dataclasses / simple classes over large dicts for evolving structured data.
- Avoid global mutable state; pass explicit context objects (engine, config) where practical.
- Raise domain-specific errors from `game_error.py` (avoid bare `Exception`).

## Naming

Avoid abbreviations unless ubiquitous (e.g. `cfg` discouraged, use `config`).

| Convention                | Python            | TypeScript (regular) | TypeScript (React)  |
|---------------------------|-------------------|----------------------|---------------------|
| **Modules**               | `snake_case.py`   | `camelCase.ts`       | `PascalCase.tsx`    |
| **Classes**               | `PascalCase`      | `PascalCase`         | -                   |
| **Functions**             | `snake_case`      | `camelCase`          | `PascalCase` (components) |
| **Variables**             | `snake_case`      | `camelCase`          | `camelCase`         |
| **Constants / Enum Members** | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE`  |

## Backend Errors
- Validate inputs at boundaries (API layer) with pydantic models.
- For game logic errors, use `GameError`.

## Tests
- One logical concept per test.
- Use factories / helpers / fixtures to reduce duplication when setup grows.
- Prefer asserting explicit values over broad truthiness.

## JavaScript / Frontend
- Use TypeScript for new modules when possible
- Keep components small; extract pure utility functions to `src/utils`.
- Prefer composition over deep prop drilling (introduce context/provider if needed).

## Dependency Policy
- Favor standard library first.
- Add third-party libs only with clear benefit (performance, security, maintenance reduction).
- Periodically review for unused dependencies.

## Git / Commits
- Conventional Commits enforced culturally (see CONTRIBUTING.md).
- Commit small, logical changes; avoid giant multi-purpose commits.

## Commenting
- Explain "why" not obvious from code; omit redundant "what" comments.
- Mark intentional fallthrough / tricky invariants.

## Security Considerations
- Sanitize / validate all player-provided inputs.
- Avoid leaking internal state in error traces over the network.

---
See: [CONTRIBUTING.md](CONTRIBUTING.md) for workflow & tooling specifics.
