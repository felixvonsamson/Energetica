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
9. Commit following Conventional Commit style (see below) and open a Pull Request (PR).

## Code of Conduct
Be respectful, constructive, and empathetic. Disagreement is fine; disrespect is not. If in doubt, be kind. Harassment or exclusionary behavior is not tolerated. Report concerns privately to the maintainers.

## Licensing
All contributions are made under the existing project license (AGPL-3.0+). By submitting a PR you agree your work will be licensed accordingly. Ensure you only contribute code you are allowed to license under AGPL.

## Project Architecture (High-Level)
- `main.py`: Entry point, launches FastAPI (via Uvicorn) with game config encoded in `ENERGETICA_APP_CONFIG`.
- `energetica/`: Core backend modules (game engine, API layer, database models, config, utilities).
- `frontend/`: Static & build assets (Vite + vanilla JS / p5.js + Jinja templating).
- `tests/`: Split into `unit/` and `integration/` suites. Add new tests accordingly.
- `map_generation/`: Tools to generate map layouts.
- `instance/`: Runtime state & checkpoints (do not commit). Can be safely removed with `--rm_instance` flag or dedicated task.

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
- For larger restructuring (e.g. current `refactor/restructure-and-rename-databse`) sync frequently with `dev` to reduce merge pain.
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
The new React frontend is new and in active development.

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
- isort (if needed separately):
```
isort .
```
- Pylint (optional deeper static analysis): run in editors / CI if configured.
- Max line length: 120
- Docstring style: If docstring fits on one line, open & close quotes on that line; otherwise use multi-line form with triple quotes on their own lines.
- JS: use VS Code default formatter / Prettier (see `.prettierrc.json`)
- Jinja: use `djLint` for template formatting.

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
Optional early stops and checkpoints: `--simulate_till`, `--simulate_checkpoint_every_k_ticks`, `--simulate_checkpoint_ticks 100 500 1000`.
Use profiling with `--simulate_profiling` and investigate hotspots before optimizing.

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
- [ ] Branch up to date with `main`
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
If you find a potential security, privacy, or integrity issue (e.g., auth bypass, data corruption vector), DO NOT open a public issue. Instead, contact the maintainers privately (add email or contact channel here if available). Provide steps to reproduce and impact summary.

## Documentation Improvements
Small fixes (typos, clarity) are welcome. For conceptual docs (architecture, gameplay mechanics), open an issue first if the scope is broad.

## Style Summary
- Python: explicit, typed where practical (ruff enforces selected ANN rules)
- Avoid premature optimization; favor clarity
- Keep functions focused; consider splitting if > ~80 lines or handling many concerns
- Avoid cyclic imports; restructure modules or use local imports when necessary

## Adding Dependencies
- Justify the need (size, maintenance, security)
- Prefer widely used, actively maintained libraries
- Update `requirements.txt` and pin if reproducibility becomes an issue (currently unpinned)
- Avoid heavy frameworks for small utilities

## Roadmap Ideas (Open for Contribution)
- Improved simulation tooling & metrics output
- Enhanced frontend UI/UX polish
- Achievement / progression balancing
- Performance instrumentation & profiling dashboards
- Better save/load & migration tooling

## Getting Help
Open a discussion / issue with: context, what you tried, logs / tracebacks, and environment info. Be concise but complete.

## Thank You
Your time and contributions make Energetica better for everyone exploring energy systems. 🚀
