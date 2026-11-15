# Project Structure

Overview of the project and directory structure.

```
Energetica/
├── src/
│   ├── energetica/       # Python/FastAPI backend: the instance apps (persistent world, Workshop) and the lobby
│   └── lobby_service/    # The one process that opens lobby.db, behind an internal API (ADR-0009)
├── main.py               # Launcher for an instance (persistent world or Workshop, by Run mode)
├── main_lobby.py         # Launcher for the lobby backend
├── main_lobby_service.py # Launcher for the lobby service
├── tests/
│   ├── unit/             # Fast, isolated tests
│   └── integration/      # App, router, game-loop and real-process tests
├── frontend/             # React/TypeScript frontend (see Frontend below)
├── scripts/              # Developer, deploy, provisioning and operator scripts (see Scripts below)
├── tools/
│   └── map_generation/   # Offline map-authoring tool, outside the import graph
├── docs/                 # This documentation
├── CONTEXT.md            # Glossary of the project's domain terms
├── instance/             # Local game state (not committed)
└── checkpoints/          # Local game backups (not committed)
```

Each launcher at the root parses its command-line arguments and starts its app under uvicorn, the
web server. `main.py` builds its app through `energetica.entry`, which picks the persistent world
or the Workshop by the instance's Run mode. The deployed services run the same launchers.

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
src/
├── energetica/
│   ├── entry.py          # Builds the app for this instance's Run mode
│   ├── kernel/           # Error types, session signing, hashing, version, formatting, atomic file writes
│   ├── identity/         # The run-side account type, the lobby service client, instance and server
│   │                     #   configuration, my-runs, and the request dependencies for the caller's account and role
│   ├── sim/              # The shared simulation layer: market clearing and settlement, dispatch,
│   │                     #   renewables and their weather, fuel and pollution, operating cost, facility statuses
│   ├── lobby/            # The lobby backend, the server-wide front door
│   ├── workshop/         # Workshop Mode: its app, its session state machine and its own persistence
│   └── freeplay/         # The persistent world
│       ├── app.py        # Application factory (create_app)
│       ├── game_engine.py    # The engine: clock, lock, save and checkpoint (see ADR-0011)
│       ├── globals.py    # The process's one engine
│       ├── database/     # Model base class, the in-memory id-keyed model store, and game state models
│       ├── action_log.py # Reader for the action log the engine writes and replays
│       ├── simulate.py   # Replays the action log
│       ├── legacy_pickle.py  # Loads saves pickled before the classes they name moved
│       ├── production_update.py   # Per-tick production, demand and market update
│       ├── technology_effects.py  # How technology levels change facilities and prices
│       ├── national_demand.py     # The national demand curve
│       ├── demand_shape.py        # Interpolates a demand curve onto the tick grid
│       ├── config/       # Asset, achievement and climate-event configuration
│       ├── enums.py      # The game's enumerations (facility types, fuels, technologies, ...)
│       ├── constants.py  # Constants of the persistent world's rules
│       ├── game_error.py # The persistent world's own error codes
│       ├── routers/      # API endpoints
│       ├── schemas/      # Pydantic models for the API and the action log
│       ├── socketio.py   # Real-time layer (Socket.IO server)
│       ├── utils/        # Helpers for routers and the tick loop (auth, map, projects, tick execution, ...)
│       ├── init_test_players.py  # Test-player fixture for local development
│       └── data/         # The game's data tables (map, quiz, demand curves)
└── lobby_service/        # Owns lobby.db: accounts, memberships, facilitator grants, run config (ADR-0009, ADR-0010)
    ├── app.py            # Its internal API, reached only over a Unix socket
    ├── store.py          # The SQL behind the API
    ├── schema.py         # The lobby.db schema
    ├── session.py        # The session-signing secret, password hashing, session tokens
    └── migrations/       # Schema migrations for lobby.db
```

`kernel`, `identity` and `sim` are layers, in that order from the bottom: each may import only the
layers below it. The three apps, `freeplay`, `workshop` and `lobby`, sit above them and never
import one another. `entry` sits on top. `lobby_service` sits outside `energetica`: no module in
`energetica` imports it, and it imports only `identity` and `kernel`. The import contracts in
`pyproject.toml` enforce this in CI; see [CONTRIBUTING.md](../../CONTRIBUTING.md) § Linting &
Formatting.

`freeplay` is the persistent world's name in code. Prose calls it "the persistent world"
(`CONTEXT.md` § Run modes).

The game engine and the model store look like shared infrastructure, but they belong to
`freeplay`, so the Workshop cannot inherit them by accident.
[ADR-0011](../adr/0011-engine-and-model-store-belong-to-freeplay.md) records why.

## Scripts

```
scripts/
├── dev.sh                # One-terminal launcher for a full local stack (see local-development.md)
├── dev-app.sh, dev-lobby.sh, dev-login.sh   # Run one part of the local stack, or mint a dev session
├── setup-worktree.sh     # Run once after `git worktree add`
├── generate-types.sh     # `bun run generate-types`: OpenAPI schemas to TypeScript types, one file per app
├── generate_openapi_schema.py               # Writes each backend app's OpenAPI schema, for the above
├── guard-*.ts            # CI guards on the frontend (file names, image weight, dummy data, raw HTML)
├── deploy-instance.sh, deploy-lobby.sh, deploy-landing.sh   # Deploys (see deployment.md)
├── deployed-versions.sh, list-instances.sh, download-instance.sh, push-bootstrap.sh   # Operating a server
├── lib/                  # Shell helpers the deploy and dev scripts share
├── infra/                # Server setup and teardown, systemd units, Apache config, and their templates
├── lobby/                # Operator clients of the lobby service: runs, facilitators, private rosters, Workshop teams
├── instance/             # One-off scripts against a persistent-world instance's saved state
├── workshop_bots/        # Bots that play a Workshop Run through its API
├── workshop_lcoe.py      # Each Workshop generator's levelized cost of electricity
└── dev/                  # Asset and docs utilities: wiki-link check, image optimisation, logo and coin generators
```

The scripts are run by people and by CI. They are not part of the backend: nothing under `src/`
imports them.

## Frontend

The frontend is a set of Bun workspaces rooted at `frontend/`. Each app is a workspace package of its own under `frontend/apps/`: the persistent world (`frontend/apps/freeplay`, `@energetica/freeplay`), the Workshop (`frontend/apps/workshop`, `@energetica/workshop`), the lobby (`frontend/apps/lobby`, `@energetica/lobby`) and the landing page (`frontend/apps/landing`, `@energetica/landing`). An Instance is served the app for its Run mode, so neither Instance app asks the backend which mode it is in. An app has its own `package.json`, `vite.config.ts`, `tsconfig.json` and `index.html`, builds to its own `dist/`, and imports only its own `src/` (through `@/`) and the shared packages. An app with a backend also has its own generated API types in `src/types/api.generated.ts`, so it cannot type-check against routes another app serves. Code the apps share lives in workspace packages under `frontend/packages/`:

- `@energetica/ui`: the customised shadcn components, the `cn` helper, a few generic React hooks (such as `useContainerDimensions` and `useLocalStorage`), the theme context, the global stylesheet, the logo, and the facility and fuel images both Instance apps show. The stylesheet defines each asset's colour, so the package also has the helpers that read them (`asset-colors`, `useAssetColorGetter`), the CSS colour helpers (`color-utils`) and `MagnitudeBar`, a table's inline bar in a row's colour.
- `@energetica/core`: the API client, `createErrorMessages` (turns an app's table of error-code messages into readable error helpers), the messages of the error codes every app shares and `errorMessageTable`, which joins them with an app's own (see [Error handling](error-handling.md)), the formatting helpers, `createQueryClient` (the query client factory) and the links between the apex, the lobby and the Instances (`instances.ts`, `single-origin.ts`).
- `@energetica/map`: the hex map (canvas, tiles, hover border, resource buttons and heatmap colours). It draws `MapTile`s, a type it declares itself, so it needs no app's generated types. Freeplay's settle and community map pages and the lobby's run recap use it. An app under `apps/` that renders the map imports `@energetica/map/styles/sources.css` in the same stylesheet as `@energetica/ui/global.css`, for the same reason as the content package below.
- `@energetica/charts`: the charts the persistent world and the Workshop share: the time-series chart, the power chart, the storage chart and the merit-order view, with their helpers and `usePlayerColors`. They are display-only. They fetch nothing and know no app's data: each app passes in its data, labels and colours, and the chart's time axis, as props, and the power chart's series order. The storage chart orders the storage facility types itself. The package declares the shapes it draws, as `@energetica/map` does, so it needs no app's generated types. Each app keeps its own data-fetching and its own wrappers, such as the persistent world's `EChartsTimeSeries`, which puts the shared chart on its game-tick axis, and the Workshop's `useWorkshopPlayerColors`. An app under `apps/` that renders the charts imports `@energetica/charts/styles/sources.css` in the same stylesheet as `@energetica/ui/global.css`, as for the map.
- `@energetica/facility-cards`: the Workshop's facility card, so the landing page can show it too. It holds `FacilityCard` and its parts, the metric tooltips, the parts of the price tag that only draw it, such as `PriceTagFace`, and the pure helpers they use: the facility images and colours, the tooltips' figures and number formats. They are display-only. The card fetches nothing: what its tooltips need beyond the facility, such as fuel prices and the carbon tax, comes in as a `tooltipInputs` prop, and `tooltips={false}` drops every tooltip. The package declares the shapes it draws, `FacilityCardData` and `TooltipInputs`, as `@energetica/charts` does. The Workshop passes its API data, which has those fields, and keeps its own wrapper, `WorkshopFacilityCard`, which loads the tooltip inputs, and the price tag's turning over and buying. An app under `apps/` that renders the cards imports `@energetica/facility-cards/styles/sources.css` in the same stylesheet as `@energetica/ui/global.css`, as for the map. The landing page's cards draw demo data that `bun run generate-showcase-data` writes from the Workshop backend to `frontend/apps/landing/src/lib/facility-showcase.generated.ts`. Each facility is built the way the facilities route builds it, and a test fails when the checked-in copy is stale.
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
