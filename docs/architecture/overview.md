# Project Structure

Overview of the project and directory structure.

```
Energetica/
├── docs/                 # This documentation
├── src/
│   ├── energetica/       # Python/FastAPI backend — one game instance
│   └── lobby/            # Python/FastAPI backend — the server-wide front door
├── main.py               # Launcher for a game instance
├── main_lobby.py         # Launcher for the lobby service
├── tests/                # Backend unit/integration tests
├── frontend/             # React/TypeScript frontend
├── scripts/              # Deploy, provisioning and one-off operational scripts
├── map_generation/       # Offline map-authoring tool
├── instance/             # Game saves
└── checkpoints/          # Game backups
```

The backend is an installed Python project: `pip install -e '.[dev]'` (see
[installation.md](../getting-started/installation.md)). The `src/` layout means the packages are
never importable just because a process happens to start in the repository root — development and
production import the same code the same way.

### Key Technologies

| Component         | Tech                     | Purpose                              |
| ----------------- | ------------------------ | ------------------------------------ |
| **Game Engine**   | Custom Python            | Core game logic game, tick scheduler |
| **Database**      | In-memory + disk         | Game state, persistence              |
| **Backend**       | FastAPI                  | REST API                             |
| **Real-time**     | Socket.IO                | Live updates, game ticks             |
| **Frontend**      | React 18 + TypeScript    | Web UI                               |
| **UI Components** | Custom component library | Visually cohesive UI and UX          |
| **Routing**       | TanStack Router          | Client-side navigation               |
| **Data Fetching** | TanStack Query           | Server state management              |
| **Styling**       | Tailwind CSS             | Component styles                     |

## Backend

```
src/energetica/       # Python/FastAPI backend
├── routers/          # API endpoints
├── schemas/          # Pydantic models
├── kernel/           # Error types, session signing, hashing, version, formatting
├── identity/         # Accounts store, instance and server configuration, my-runs
├── sim/              # Market clearing and settlement, facility statuses
└── freeplay/         # The persistent world
    ├── app.py        # Application factory (create_app)
    ├── game_engine.py  # Core game logic
    ├── database/     # Model base class, id-keyed store, and game state models
    ├── action_log.py # Reader for the action log the engine writes and replays
    └── data/         # The game's data tables (map, quiz, demand curves)
```

## Frontend

The frontend is a set of Bun workspaces rooted at `frontend/`. The combined app, the lobby and the landing page are built from `frontend/src/`. Code they share lives in workspace packages under `frontend/packages/`:

- `@energetica/ui`: the customised shadcn components, the `cn` helper, the theme context and the global stylesheet.
- `@energetica/core`: the API client, the formatting helpers and `createQueryClient`, the query client factory.

Bun's isolated install layout means a package can only import the dependencies its own `package.json` declares. Dependency versions shared by several packages are pinned once, in the `catalog` of `frontend/package.json`, and referenced as `"catalog:"`. Lint rejects imports across these boundaries; `frontend/boundaries.test.ts` shows which.

```
frontend/src/
├── components/
│   ├── ui/              # Game-specific UI pieces (Duration, AssetIcon, PlayerName)
│   ├── layout/          # Layout components (TopBar, Navigation, GameLayout)
│   ├── <features>/      # Feature-specific components (Dashboard, Facilities)
│   └── auth/            # Auth-related components for protected routes
├── hooks/               # Custom React hooks
│   └── use*.ts          # One hook per file, prefixed with 'use'
├── lib/                 # Utilities and configs
│   ├── api/             # API client modules (*-api.ts files)
│   ├── query-client.ts  # This app's query client and query keys
│   └── other utilities  # date-utils, hex-utils, etc.
├── contexts/            # React contexts
├── types/               # TypeScript types
└── routes/              # TanStack Router routes
    └── app/             # Game routes under /app/*
```

### Path Alias

The `@` path alias points to [`src/`](/frontend/src/). This is configured in [`tsconfig.json`](/frontend/tsconfig.json) and [`vite.config.ts`](/frontend/vite.config.ts).

Use this alias instead of relative paths for all internal imports. Shared packages are the exception: `@/` means the app's `src/`, so inside a package, use relative imports. This makes imports more readable and facilitates refactoring:

```tsx
// Example usage, taken from dashboard.tsx
import { AchievementCard } from "@/components/dashboard/AchievementCard";
import { useAchievements } from "@/hooks/useAchievements";
import { getMonthName } from "@/lib/date-utils";
```
