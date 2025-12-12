# Project Structure

Overview of the project and directory structure.

```
Energetica/
├── docs/                 # This documentation
├── energetica/           # Python/FastAPI backend
├── tests/                # Backend unit/integration tests
├── frontend/             # React/TypeScript frontend
├── instance/             # Game saves
└── checkpoints/          # Game backups
```

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
energetica/           # Python/FastAPI backend
├── routers/          # API endpoints
├── schemas/          # Pydantic models
├── database/         # Game state models
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
