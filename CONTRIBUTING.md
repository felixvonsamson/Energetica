# Contributing to Energetica

Thanks for your interest in improving Energetica – an educational strategy game about electricity and energy systems. This guide explains how to propose changes, report issues, and submit code in a way that keeps the project healthy and maintainable.

## Quick Start (TL;DR)
1. Fork + clone the repo.
2. Create a feature branch from `dev`
3. Create / activate a Python 3.11 or 3.12 virtual environment.
4. `pip install -r requirements.txt`
5. (Frontend) `cd frontend && npm install`
6. Run backend: `python main.py --env dev`
7. Run tests: `pytest`
8. Lint & format: `ruff check .` (and other tooling below)
9. Commit following Conventional Commit style (see below) and open a Pull Request (PR) against `dev`.

## Community Standards
Energetica welcomes contributors of all backgrounds. Please use inclusive, respectful language and provide constructive feedback. Harassment, discrimination, or inappropriate conduct will not be tolerated. If you encounter any issues, report them privately to the maintainers.

## Licensing
All contributions are made under the existing project license (AGPL-3.0+). By submitting a PR you agree your work will be licensed accordingly. Ensure you only contribute code you are allowed to license under AGPL.

## Project Architecture (High-Level)
See [ARCHITECTURE.md](ARCHITECTURE.md) for diagrams, module interactions, and engine data flow.
- `main.py`: Entry point launching the API + game tick loop.
- `energetica/`: Core engine logic & API.
- `frontend/`: Vite/JS frontend (migration in progress).
- `tests/`: Unit vs integration suites.
- `map_generation/`: Map layout tooling.
- `instance/`: Runtime state (never commit).

## Issues & Feature Requests
- Search existing issues first to avoid duplicates.
- When opening a new issue:
  - Clear, action-oriented title
  - Describe current behavior vs expected behavior
  - Include reproduction steps (commands, flags, test accounts, etc.)
  - Environment details (OS, Python version, branch)
  - Attach logs or minimal test code if helpful
- Feature request? Explain the motivation, user impact, and rough implementation idea.

## Branching & Workflow
- Default branch: `dev`
- Use short-lived feature branches: `feature/<summary>`, `fix/<issue-id>-<summary>`, `refactor/...`, `docs/...`
- For larger restructuring (e.g. current `refactor/restructure-and-rename-database`) sync frequently with `dev` to reduce merge pain.
- All PRs should target `dev` (only merge `dev` -> `main` during release workflow).
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
Target versions: 3.11 or 3.12 (ruff target currently 3.12). Use a virtual environment:
```
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
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
npm install
npm run dev  # Vite dev server
npm run build
```
The React frontend is in active development; some legacy vanilla JS / p5.js + Jinja pieces may remain during migration.

## Testing
We use `pytest`.
- Place fast, isolated tests in `tests/unit/`
- Cross-module/API/game-loop tests in `tests/integration/`
- Name test files: `test_<thing>.py`
- Write descriptive test function names.
- Run full suite:
```
pytest -q
```
- Run a subset:
```
pytest tests/unit/test_player.py::test_new_player
```
Add tests for every new feature and bug fix.

### Test Helpers
- Use existing sample tests as templates (`sample_unit_test.py`, etc.)
- Consider adding factory helpers if object setup becomes repetitive.

## Linting & Formatting
Configured via `pyproject.toml`.
- Ruff (lint + some formatting):
```
ruff check .
ruff fix .  # to apply safe fixes
```
(If using Ruff's formatter:)
```
ruff format .
```
- Pylint (optional deeper static analysis): run in editors / CI if configured.
- Max line length: 120
- Docstring style: If docstring fits on one line, open & close quotes on that line; otherwise use multi-line form with triple quotes on their own lines.
- JS: use VS Code default formatter / Prettier (see `.prettierrc.json`)
- Jinja: use `djLint` for template formatting.

### Pre-Commit Hooks

Pre-commit hooks ensure code quality by running linters and formatters on staged files before each commit.

```bash
pip install pre-commit # Install pre-commit
pre-commit install # Enable hooks. Hooks run automatically on commit.
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
1. Locate relevant engine modules under `energetica/` (e.g. production updates, climate events, technology effects).
2. Add or update enums in `enums.py` carefully—changing identifiers may break saved state.
3. Provide migration / compatibility handling if saved engine data format changes.
4. Add unit tests that cover both the new behavior and backward compatibility paths.

## Logging & Debugging
- Prefer structured, minimal logs; avoid spamming per-tick unless investigating a bug.
- Remove or gate heavy debug prints before merging (use a flag or environment variable if needed).

## Pull Request Checklist
Before opening a PR, ensure:
- [ ] Branch up to date with `dev` (or with `main` only when preparing a release)
- [ ] Tests pass locally (`pytest`)
- [ ] New/changed code is covered by tests
- [ ] Lint passes (`ruff check .`)
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
Condensed overview—see full guidelines in [STYLEGUIDE.md](STYLEGUIDE.md):
- Python: explicit, typed where practical (ruff enforces selected ANN rules)
- Keep functions focused; consider splitting if > ~80 lines or many concerns

## Adding Dependencies
- Justify the need (size, maintenance, security)
- Prefer widely used, actively maintained libraries
- Update `requirements.txt` and pin if reproducibility becomes an issue (currently unpinned)
- Avoid heavy frameworks for small utilities

## Getting Help
Open a discussion / issue with: context, what you tried, logs / tracebacks, and environment info. Be concise but complete.

## Thank You
Your time and contributions make Energetica better for everyone exploring energy systems. 🚀
