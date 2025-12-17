# Getting Started

Commands to run to get started and to run the project code

# Installation

```bash
# Clone the repository
git clone https://github.com/felixvonsamson/Energetica
cd Energetica

# Backend setup
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend setup
cd frontend
npm install
cd ..
```

## Quick Reference

### Frontend Commands

```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm run lint:check       # Check ESLint errors
npm run tsc:check        # TypeScript type checking
npm run pretty           # Format code
npm run generate-types   # Generate API types from OpenAPI schema
```

#### Type Generation

`npm run generate-types` automatically generates TypeScript types from the backend's OpenAPI schema. The script:
1. Runs `scripts/generate_openapi_schema.py` to generate OpenAPI spec from the FastAPI app (no server required)
2. Uses `openapi-typescript` to generate types in `frontend/src/types/api.generated.ts`
3. Formats the output with Prettier

The backend server does not need to be running.

### Backend Commands

```bash
python main.py --env dev        # Run dev server
pytest                          # Run tests
ruff check                      # Lint check
ruff format                     # Auto-format
pyright                         # Type checking
```

## Running Locally

**Terminal 1 - Backend:**

```bash
source .venv/bin/activate
python main.py --env dev
# Backend running on http://localhost:5001
```

**Terminal 2 - Frontend:**

```bash
cd frontend
npm run dev
# Frontend running on http://localhost:5173
```

**Verify both are running:**

-   Backend: http://localhost:5001 (Jinja templates)
-   Frontend: http://localhost:5173/app/dashboard (React)

## Next Steps After Setup

[**Architecture Overview**](../architecture/overview.md)
