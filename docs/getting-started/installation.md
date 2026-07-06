# Installation

One-time setup to get Energetica building on your machine. Once this is done, see
[local-development.md](./local-development.md) for how to actually run things day to day.

## Prerequisites

- **Python 3.12 or higher** (`python --version` or `python3 --version`)
- **Bun 1.0 or higher** (`bun --version`) — [install Bun](https://bun.sh): `curl -fsSL https://bun.sh/install | bash`
- **Git** (`git --version`)

## 1. Clone

```bash
git clone https://github.com/felixvonsamson/Energetica
cd Energetica
```

## 2. Backend (Python)

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

The project scripts invoke the interpreter at `.venv/bin/python` directly, so you don't need the
venv activated to run them — but activate it when running `python`, `pytest`, `ruff`, or `pyright`
by hand.

## 3. Frontend (TypeScript)

```bash
cd frontend
bun install
cd ..
```

## You're set up

Verify the toolchain is wired up:

```bash
bun run typecheck        # frontend TypeScript
bun run typecheck:py     # backend (pyright)
```

Now head to **[local-development.md](./local-development.md)** — it covers the three frontend
surfaces (app / lobby / landing), how to run against a local vs. a live backend, and the one-command
full-stack launcher (`bun run dev`).

The quickest first run:

```bash
bun run dev              # full local stack, then open http://localhost:5173 and log in as demo / demo1234
```

## Getting Help

- **Issues:** [GitHub Issues](https://github.com/felixvonsamson/Energetica/issues)
- **Discussions:** [GitHub Discussions](https://github.com/felixvonsamson/Energetica/discussions)
- **Documentation:** the [`docs/`](../README.md) folder

Welcome to the Energetica project! Happy coding!
