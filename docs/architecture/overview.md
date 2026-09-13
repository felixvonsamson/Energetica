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
├── database/         # Game state models
├── static/           # Web assets (app bundle, images) and the game's data tables
└── game_engine.py    # Core game logic
```

## Frontend

```
frontend/src/
├── components/
│   ├── ui/              # Reusable UI primitives (Card, Button, Modal)
│   ├── layout/          # Layout components (TopBar, Navigation, GameLayout)
│   ├── <features>/      # Feature-specific components (Dashboard, Facilities)
│   └── auth/            # Auth-related components for protected routes
├── hooks/               # Custom React hooks
│   └── use*.ts          # One hook per file, prefixed with 'use'
├── lib/                 # Utilities and configs
│   ├── api/             # API client modules (*-api.ts files)
│   ├── query-client.ts  # TanStack Query config
│   ├── cn.ts            # Tailwind class name merging utility
│   ├── format-utils.ts  # Number and value formatting utilities
│   └── other utilities  # date-utils, hex-utils, etc.
├── contexts/            # React contexts
├── types/               # TypeScript types
└── routes/              # TanStack Router routes
    └── app/             # Game routes under /app/*
```

### Path Alias

The `@` path alias points to [`src/`](/frontend/src/). This is configured in [`tsconfig.json`](/frontend/tsconfig.json) and [`vite.config.ts`](/frontend/vite.config.ts).

Use this alias instead of relative paths for all internal imports. This makes imports more readable and facilitates refactoring:

```tsx
// Example usage, taken from dashboard.tsx
import { AchievementCard } from "@/components/dashboard/AchievementCard";
import { useAchievements } from "@/hooks/useAchievements";
import { getMonthName } from "@/lib/date-utils";
```
