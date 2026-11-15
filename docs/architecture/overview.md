# Project Structure

Overview of the project and directory structure.

```
Energetica/
├── docs/                 # This documentation
├── src/
│   ├── energetica/       # Python/FastAPI backend — the game instance apps and the lobby
│   └── lobby_service/    # The one process that opens lobby.db, behind an internal API
├── main.py               # Launcher for a game instance
├── main_lobby.py         # Launcher for the lobby backend
├── main_lobby_service.py # Launcher for the lobby service (owns lobby.db)
├── tests/                # Backend unit/integration tests
├── frontend/             # React/TypeScript frontend
├── scripts/              # Deploy, provisioning and one-off operational scripts
├── tools/
│   └── map_generation/   # Offline map-authoring tool, outside the import graph
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
├── entry.py          # Builds the app for this instance's Run mode
├── kernel/           # Error types, session signing, hashing, version, formatting, atomic file writes
├── identity/         # Accounts store, instance and server configuration, my-runs
├── sim/              # Market clearing and settlement, facility statuses
├── lobby/            # The lobby backend, the server-wide front door
├── workshop/         # Workshop Mode
└── freeplay/         # The persistent world
    ├── app.py        # Application factory (create_app)
    ├── routers/      # API endpoints
    ├── schemas/      # Pydantic models for the API and the action log
    ├── socketio.py   # Real-time layer (Socket.IO server)
    ├── utils/        # Helpers for routers and the tick loop (auth, map, projects, tick execution, ...)
    ├── simulate.py   # Replays the action log
    ├── init_test_players.py  # Test-player fixture for local development
    ├── game_engine.py  # Core game logic
    ├── database/     # Model base class, id-keyed store, and game state models
    ├── production_update.py   # Per-tick production, demand and market update
    ├── technology_effects.py  # How technology levels change facilities and prices
    ├── config/       # Asset, achievement and climate-event configuration
    ├── enums.py      # The game's enumerations (facility types, fuels, technologies, ...)
    ├── action_log.py # Reader for the action log the engine writes and replays
    └── data/         # The game's data tables (map, quiz, demand curves)
```

`kernel`, `identity` and `sim` are layers, in that order from the bottom: each may import only the
layers below it. The three apps, `freeplay`, `workshop` and `lobby`, sit above them and never
import one another. `entry` sits on top. The import contracts in `pyproject.toml` enforce this in
CI; see [CONTRIBUTING.md](../../CONTRIBUTING.md) § Linting & Formatting.

## Frontend

The frontend is a set of Bun workspaces rooted at `frontend/`. Each app is a workspace package of its own under `frontend/apps/`: the persistent world (`frontend/apps/freeplay`, `@energetica/freeplay`), the Workshop (`frontend/apps/workshop`, `@energetica/workshop`), the lobby (`frontend/apps/lobby`, `@energetica/lobby`) and the landing page (`frontend/apps/landing`, `@energetica/landing`). An Instance is served the app for its Run mode, so neither Instance app asks the backend which mode it is in. An app has its own `package.json`, `vite.config.ts`, `tsconfig.json` and `index.html`, builds to its own `dist/`, and imports only its own `src/` (through `@/`) and the shared packages. An app with a backend also has its own generated API types in `src/types/api.generated.ts`, so it cannot type-check against routes another app serves. Code the apps share lives in workspace packages under `frontend/packages/`:

- `@energetica/ui`: the customised shadcn components, the `cn` helper, a few generic React hooks (such as `useContainerDimensions` and `useLocalStorage`), the theme context, the global stylesheet, the logo, and the facility and fuel images both Instance apps show. The stylesheet defines each asset's colour, so the package also has the helpers that read them (`asset-colors`, `useAssetColorGetter`), the CSS colour helpers (`color-utils`) and `MagnitudeBar`, a table's inline bar in a row's colour.
- `@energetica/core`: the API client, `createErrorMessages` (turns an app's table of error-code messages into readable error helpers), the messages of the error codes every app shares and `errorMessageTable`, which joins them with an app's own (see [Error handling](error-handling.md)), the formatting helpers, `createQueryClient` (the query client factory) and the links between the apex, the lobby and the Instances (`instances.ts`, `single-origin.ts`).
- `@energetica/map`: the hex map (canvas, tiles, hover border, resource buttons and heatmap colours). It draws `MapTile`s, a type it declares itself, so it needs no app's generated types. Freeplay's settle and community map pages and the lobby's run recap use it. An app under `apps/` that renders the map imports `@energetica/map/styles/sources.css` in the same stylesheet as `@energetica/ui/global.css`, for the same reason as the content package below.
- `@energetica/charts`: the charts the persistent world and the Workshop share: the time-series chart, the power chart, the storage chart and the merit-order view, with their helpers and `usePlayerColors`. They are display-only. They fetch nothing and know no app's data: each app passes in its data, labels and colours, and the chart's time axis, as props, and the power chart's series order. The storage chart orders the storage facility types itself. The package declares the shapes it draws, as `@energetica/map` does, so it needs no app's generated types. Each app keeps its own data-fetching and its own wrappers, such as the persistent world's `EChartsTimeSeries`, which puts the shared chart on its game-tick axis, and the Workshop's `useWorkshopPlayerColors`. An app under `apps/` that renders the charts imports `@energetica/charts/styles/sources.css` in the same stylesheet as `@energetica/ui/global.css`, as for the map.
- `@energetica/facility-cards`: the Workshop's facility card, so the landing page can show it too. It holds `FacilityCard` and its parts, the metric tooltips, the parts of the price tag that only draw it, such as `PriceTagFace`, and the pure helpers they use: the facility images and colours, the tooltips' figures and number formats. They are display-only. The card fetches nothing: what its tooltips need beyond the facility, such as fuel prices and the carbon tax, comes in as a `tooltipInputs` prop, and `tooltips={false}` drops every tooltip. The package declares the shapes it draws, `FacilityCardData` and `TooltipInputs`, as `@energetica/charts` does. The Workshop passes its API data, which has those fields, and keeps its own wrapper, `WorkshopFacilityCard`, which loads the tooltip inputs, and the price tag's turning over and buying. An app under `apps/` that renders the cards imports `@energetica/facility-cards/styles/sources.css` in the same stylesheet as `@energetica/ui/global.css`, as for the map.
- `@energetica/instance`: the parts of the pages both Instance apps serve, the join page and the facilitator's join-link and roster pages: components, hooks, API calls, helpers and their query keys (`instanceQueryKeys`). It also has the messages of the identity layer's error codes. It is a kit of parts, not finished pages. Each app assembles its own pages from them in its own route files, and passes in anything app-specific: where a link or navigation goes, as a callback or a link to render, and how an API error reads, as a `formatError` prop. The parts never link to an app route and never ask which Run mode they are in. An app under `apps/` that renders them imports `@energetica/instance/styles/sources.css` in the same stylesheet as `@energetica/ui/global.css`, as for the map.
- `@energetica/content`: the wiki pages and the changelog, written in MDX, with their figures and the components they import. Its `contentMdx()` Vite plugin compiles them; see [Wiki pages](../frontend/wiki-pages.md). An app under `apps/` that renders them imports `@energetica/content/styles/sources.css` in the same stylesheet as `@energetica/ui/global.css`, because Tailwind only scans the app's own directory for class names.

A shared package that calls the API gets its types through the `@api` alias, always with `import type`. Each app points `@api` at its own `api-helpers.ts`, in its `tsconfig.json`, `vite.config.ts` and `vitest.config.ts`, so the package is type-checked inside each app against the routes that app serves. The package's own `tsconfig.json` points `@api` at the persistent world's types, which only serves its own typecheck, lint and editor.

A Vite config that imports a workspace package, as one using `contentMdx()` does, runs with `vite --configLoader runner`. Otherwise Vite hands the package's TypeScript files to Node, which can only load them from Node 22.18 on. Other tools load the config that way, such as the Vitest VS Code extension, so a package's files must stay loadable by Node: they import each other through the package's `#<name>/` subpath imports, never through relative paths, which Node cannot resolve without a file extension.

Bun's isolated install layout means a package can only import the dependencies its own `package.json` declares. Dependency versions shared by several packages are pinned once, in the `catalog` of `frontend/package.json`, and referenced as `"catalog:"`. Lint rejects imports across these boundaries; `frontend/boundaries.test.ts` shows which.

The persistent world's app is laid out like this:

```
frontend/apps/freeplay/src/
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
│   └── other utilities  # date-utils, etc.
├── contexts/            # React contexts
├── types/               # TypeScript types
└── routes/              # TanStack Router routes
    └── app/             # Game routes under /app/*
```

### Path Alias

In each app, the `@` path alias points to that app's `src/`, such as [`frontend/apps/freeplay/src/`](/frontend/apps/freeplay/src/). Each app configures it in its own `tsconfig.json`, `vite.config.ts` and `vitest.config.ts`.

Use this alias instead of relative paths for all internal imports. Shared packages cannot use `@/`, because it means the app's `src/`. Each package declares its own alias instead, as subpath imports under `"imports"` in its `package.json`: inside `@energetica/ui`, import `#ui/lib/utils`. This makes imports more readable and facilitates refactoring:

```tsx
// Example usage, taken from dashboard.tsx
import { AchievementCard } from "@/components/dashboard/AchievementCard";
import { useAchievements } from "@/hooks/useAchievements";
import { getMonthName } from "@/lib/date-utils";
```
