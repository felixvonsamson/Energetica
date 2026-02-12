# Installation Guide

Complete setup guide for new contributors to get Energetica running locally.

## Quick Start

### Clone and Install Dependencies

```bash
# Clone and install
git clone https://github.com/felixvonsamson/Energetica
cd Energetica
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd frontend/ && bun install && cd ..
```

### Run the Backend

```bash
source .venv/bin/activate && python main.py --env dev
```

### Run the Frontend

Use existing backend:

```bash
VITE_BACKEND_URL=https://energetica-game.org bun dev
```

Use http://localhost:8000 as backend:

```bash
bun dev
```

Or configure `/frontend/.env.example`.

Visit http://localhost:5173/app/dashboard

## Prerequisites

Ensure you have the following installed:

- **Python 3.12 or higher** (`python --version` or `python3 --version`)
- **Bun 1.0 or higher** (`bun --version`) - [Install Bun](https://bun.sh)
- **Git** (`git --version`)

To install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/felixvonsamson/Energetica
cd Energetica
```

### 2. Backend Setup

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

**Note:** You'll need to activate the virtual environment (`source .venv/bin/activate`) every time you open a new terminal to work on the backend.

### 3. Frontend Setup

```bash
cd frontend
bun install
cd ..
```

### 4. Environment Configuration (Optional)

The frontend can connect to different backends via environment variables.

**For local development (default):** No configuration needed - the frontend automatically connects to `http://localhost:8000`

**To connect to a different backend:**

```bash
# Copy the example file
cp frontend/.env.example frontend/.env

# Edit frontend/.env and set:
VITE_BACKEND_URL=https://energetica-game.org  # or your preferred backend
```

## Running the Application

Energetica requires both backend and frontend servers running simultaneously.

### Full Stack Development (Recommended)

Open **two terminal windows**:

**Terminal 1 - Backend Server:**

```bash
# From project root
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python main.py --env dev
```

You should see:

```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

**Terminal 2 - Frontend Dev Server:**

```bash
# From project root
cd frontend
bun dev
```

You should see:

```
VITE vX.X.X  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Frontend-Only Development

If you only want to work on the frontend and connect to an existing backend:

```bash
cd frontend

# Connect to local backend (default)
bun dev

# OR connect to production backend
VITE_BACKEND_URL=https://energetica-game.org bun dev
```

## Quick Reference

### Frontend Commands

```bash
bun dev              # Start dev server (http://localhost:5173)
bun build            # Build for production
bun lint       # Check ESLint errors
bun typecheck        # TypeScript type checking
bun pretty           # Format code with Prettier
bun generate-types   # Generate API types from OpenAPI schema
```

### Backend Commands

```bash
python main.py --env dev        # Run dev server (http://localhost:8000)
pytest                          # Run tests
ruff check                      # Lint check
ruff format                     # Auto-format code
pyright                         # Type checking
pre-commit run --all-files      # Run all pre-commit hooks manually
```

#### Useful Development Flags

```bash
# Custom port
python main.py --env dev --port 5001

# Disable hot reload
python main.py --env dev --no-reload

# Create test players on startup
python main.py --env dev --run_init_test_players

# Remove instance folder (reset database)
python main.py --env dev --rm_instance
```

## Next Steps

Places to get started with in the documentation:

- [Architecture Overview](../architecture/overview.md) - Understand system design
- [Frontend Documentation](../frontend/overview.md) - React patterns and conventions
- [API Documentation](../architecture/api.md) - Backend API structure

## Getting Help

- **Issues:** [GitHub Issues](https://github.com/felixvonsamson/Energetica/issues)
- **Discussions:** [GitHub Discussions](https://github.com/felixvonsamson/Energetica/discussions)
- **Documentation:** Check `docs/` folder for specific topics

Welcome to the Energetica project! Happy coding!
