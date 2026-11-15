# Contributing to Energetica

Thanks for your interest in improving Energetica!

You can contribute to the codebase, but there are plenty of other ways to contribute that we really value. Your ideas and suggestions are most welcome.

If you want to experiment with making changes to the yourself, see [./docs/getting-started/installation.md](/docs/getting-started/installation.md) to get started.
n your machine to run and develop the code.

This guide explains how to propose changes, report issues, and submit code in a way that keeps the project healthy and maintainable.

## Community Standards

Energetica welcomes contributors of all backgrounds. Please use inclusive, respectful language and provide constructive feedback. Harassment, discrimination, or inappropriate conduct will not be tolerated. If you encounter any issues, report them privately to the maintainers.

## Licensing

All contributions are made under the existing project license (AGPL-3.0+). By submitting a PR you agree your work will be licensed accordingly. Ensure you only contribute code you are allowed to license under AGPL.

## Issues & Feature Requests

- Search existing issues first to avoid duplicates.
- When opening a new issue:
  - Clear, action-oriented title
  - Describe current behaviour vs expected behaviour
  - Include reproduction steps (commands, flags, test accounts, etc.)
  - Environment details (OS, Python version, branch)
  - Attach logs or minimal test code if helpful
- Feature request? Explain the motivation, user impact, and rough implementation idea.

## Branching & Workflow

- Default branch: `main`
- Use short-lived feature branches: `feature/<summary>`, `fix/<issue-id>-<summary>`, `refactor/...`, `docs/...`
- For larger restructuring, sync frequently with `main` to reduce merge pain.
- All PRs should target `main`.
- Keep PRs focused and reasonably small (< ~600 LOC diff when possible).

## Commit Message Guidelines

Use Conventional Commits. Examples:

- `feat(engine): add dynamic pricing model`
- `fix(api): correct auth token refresh bug`
- `refactor(database): consolidate player session tables`
- `test(projects): add coverage for project lifecycle`
- `docs(readme): clarify local setup steps`

Format:

```
<type>(<scope>): <short imperative summary>

[optional body]
```

Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore.

## Python Environment

Target version: 3.12 or higher (the ruff target is 3.12). Use a virtual environment:

```
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
```

The backend packages live under `src/`, so that editable install is what makes `energetica` and
`lobby_service` importable at all — without it, `pytest` and `python main.py` both fail with
`ModuleNotFoundError`. Re-run it after a change to the dependency list.

(Optional) Use `conda` if preferred.

## Running the Server (Development)

```
python main.py --env dev
```

Helpful flags:

- `--clock_time 5` (faster tick for local testing)
- `--in_game_seconds_per_tick 240` (default) or adjust for simulations
- `--run_init_test_players` (create players to test with)
- `--rm_instance` (reset state)
- `--simulate_file path/to/actions_history.log` (replay historical actions)

A VS Code task "run server" is configured in `.vscode/tasks.json`—use Command Palette: `Tasks: Run Task`.

## Frontend Development

```
cd frontend
bun install
bun dev  # Vite dev server
bun build
```

The React frontend is in active development; some legacy vanilla JS / p5.js + Jinja pieces may remain during migration.

## Testing

We use `pytest`.

- Place fast, isolated tests in `tests/unit/`
- Cross-module/API/game-loop tests in `tests/integration/`
- Inside each suite, put a test in the folder named after the package it tests: `kernel/`, `identity/`, `sim/`,
  `freeplay/`, `workshop/`, `lobby/` or `lobby_service/`. For example, the tests for
  `src/energetica/sim/market.py` go in `tests/unit/sim/`. Tests of the scripts under `scripts/` go in `tests/unit/scripts/`.
  A test that checks several packages at once, such as the import side-effect check or the error-envelope contract,
  stays at the top of its suite.
- Name test files: `test_<thing>.py`. The folder already names the package, so drop it from the file name:
  `tests/unit/workshop/test_fuel.py`, not `test_workshop_fuel.py`.
- Write descriptive test function names.
- Run full suite:

```
pytest -q
```

- Run a subset:

```
pytest tests/unit/freeplay/test_player.py::test_player_hashable
```

Add tests for every new feature and bug fix.

### Test Helpers

Shared fixtures live in `conftest.py` files, which pytest applies to every test in the folder and below it.

- `tests/conftest.py` applies to every test. Two fixtures run automatically: one puts `engine.serve_local`
  back after each test, and one makes password hashing cheap. Request `lobby_service` for a real lobby
  service over a fresh `lobby.db`, and `no_demand_growth` to keep Workshop demand flat between Rounds.
- `tests/integration/conftest.py` gives every integration test a lobby service automatically.

Helper module names start with an underscore to set them apart from test files. Import them with a relative
import:

- `tests/integration/_session_helpers.py` creates accounts through the lobby service and logs a `TestClient`
  in as one of them: `make_account`, `authenticate`, `join` and `grant_facilitator`.
- `tests/integration/_socketio_helpers.py` connects a `TestClient` to an app's Socket.IO server.
- `tests/unit/workshop/_weather_helpers.py` has fixed-weather fakes for the Workshop's Trading-period tests.

A helper used by one package's tests goes in that package's folder. A helper used across packages goes at the top
of its suite. Add a new helper when the same setup keeps repeating across test files.

## Linting & Formatting

Configured via `pyproject.toml`.

- Ruff (linter and formatter). Both cover every Python file in the repo — `src/`,
  `tests/`, `scripts/`, `tools/`, `main.py`, `main_lobby.py` — and both run as
  the `python-lint` job in CI, so a commit made with `--no-verify` still gets caught:

```
ruff check .          # lint
ruff check . --fix    # lint, applying safe fixes
ruff format .         # format
```

`pip install -e '.[dev]'` installs ruff, pinned to the same version as the pre-commit
hook. From the repo root, `bun run ruff:check` and `bun run ruff:format` are shorthands for
the fixing and formatting forms — both write to your files, neither is read-only.

- import-linter checks which backend packages may import which. Each rule is a contract,
  written in `pyproject.toml` under `[tool.importlinter]`, and CI checks them in the
  `python-lint` job. Imports through another module count too.
  - `kernel`, `identity` and `sim` are layers, in that order from the bottom. A module may
    import from the layers below it but not from those above, and none of them imports app
    code.
  - There are three apps above them: the persistent world (`energetica.freeplay`), Workshop
    (`energetica.workshop`) and the lobby (`energetica.lobby`). None of them imports another.
  - `energetica.entry` sits on top and builds whichever app an instance runs.
  - No module under `energetica` imports the lobby service (`lobby_service`), and the lobby
    service imports only `identity` and `kernel`.
  - A new top-level module under `src/energetica/` must be added to a layer, or the check
    fails. New app code goes inside its app's package rather than beside it, so the contracts
    already cover it.
  - A contract cannot see what importing a module runs.
    `tests/unit/test_import_side_effects.py` checks that importing a package does not build the
    persistent world's game engine, or load the lobby service, where it must not.

```
lint-imports          # check the import contracts
```

`pip install -e '.[dev]'` installs import-linter. In a git worktree, run
`PYTHONPATH=src lint-imports`. The shared `.venv` would otherwise resolve `energetica` to
the main checkout.

- Pylint (optional deeper static analysis): run in editors / CI if configured.
- Max line length: 120
- Docstring style: If docstring fits on one line, open & close quotes on that line; otherwise use multi-line form with triple quotes on their own lines.
- JS: use VS Code default formatter / Prettier (see `.prettierrc.json`)
- Jinja: use `djLint` for template formatting.

### Pre-Commit Hooks

Pre-commit hooks ensure code quality by running linters and formatters on staged files before each commit.

```bash
pre-commit install # Enable hooks (pre-commit itself comes with `pip install -e '.[dev]'`).
                   # Hooks run automatically on commit.
pre-commit run --all-files # Manually check all files
pre-commit autoupdate # Update hooks after having modified `.pre-commit-config.yaml`
```

## Database / State Notes

Runtime state lives under `instance/` and `checkpoints/`. Never commit these. To reset quickly:

```
python main.py --env dev --rm_instance
```

Or use the "remove instance" VS Code task.

## Performance & Simulation

When replaying logs:

```
python main.py --env dev --simulate_file actions_history.log --clock_time 1 --in_game_seconds_per_tick 3600
```

Checkpoint & profiling flags: `--simulate_till`, `--simulate_checkpoint_every_k_ticks`, `--simulate_checkpoint_ticks 100 500 1000`, `--simulate_profiling`.

## Adding / Modifying Game Logic

1. Locate relevant engine modules under `src/energetica/freeplay/` (e.g. production updates, climate events, technology effects).
2. Add or update enums in `src/energetica/freeplay/enums.py` carefully—changing identifiers may break saved state.
3. Provide migration / compatibility handling if saved engine data format changes.
4. Add unit tests that cover both the new behavior and backward compatibility paths.

## Logging & Debugging

- Prefer structured, minimal logs; avoid spamming per-tick unless investigating a bug.
- Remove or gate heavy debug prints before merging (use a flag or environment variable if needed).

## Pull Request Checklist

Before opening a PR, ensure:

- [ ] Branch up to date with `main`
- [ ] Tests pass locally (`pytest`)
- [ ] New/changed code is covered by tests
- [ ] Lint passes (`ruff check .` and `lint-imports`)
- [ ] No stray `print` debugging left (unless intentional & documented)
- [ ] Updated docs / comments where behavior changed
- [ ] Large changes broken into logical commits

## Review Process

1. CI (if configured) runs tests + linters.
2. Maintainers review for correctness, scope, style, and architecture fit.
3. Requested changes addressed via follow-up commits (avoid force-push unless rewriting history is essential).
4. Squash or rebase if requested; default merge strategy decided by maintainers.

## Security / Responsible Disclosure

If you find a potential security, privacy, or integrity issue (e.g., auth bypass, data corruption vector), DO NOT open a public issue. Instead, contact the maintainers privately. Provide steps to reproduce and impact summary.

<!-- (TODO: add security contact email or private channel here) -->

## Documentation Improvements

Small fixes (typos, clarity) are welcome. For conceptual docs (architecture, gameplay mechanics), open an issue first if the scope is broad.

## Style Summary

See [Backend Style Guide](./docs/backend/style-guide.md) and [Frontend Style Guide](./docs/frontend/style-guide.md).

## Adding Dependencies

- Justify the need (size, maintenance, security)
- Prefer widely used, actively maintained libraries
- Add it to `[project.dependencies]` in `pyproject.toml` (or `[project.optional-dependencies].dev` if it is only a development tool), and pin it if reproducibility matters
- Avoid heavy frameworks for small utilities

## Getting Help

Open a discussion / issue with: context, what you tried, logs / tracebacks, and environment info. Be concise but complete.

## Thank You

Your time and contributions make Energetica better for everyone exploring energy systems. 🚀
