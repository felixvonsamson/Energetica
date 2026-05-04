# RFC: Apache Static Serving, Split Build & Multi-Instance Deployment

**Status:** Draft  
**Branch:** `rfc/static-serving-split-build`

---

## Problem

FastAPI currently serves all static files (React bundles, images, game data) by proxying through Apache to uvicorn. Apache should handle static content natively and only forward dynamic traffic (API, WebSocket) to Python. Beyond the performance overhead, the current setup has no path to multi-instance deployment and bundles the landing/marketing site into the same JS bundle as the game.

---

## Goals

- Apache serves static files directly from the filesystem
- Split the frontend into two independent bundles: **landing** (public marketing) and **app** (game)
- Support multiple game instances per server via subdomains
- Formalise server/instance terminology and tooling

---

## Terminology

| Term | Definition |
|------|------------|
| **Server** | A VPS, identified by its SSH alias (e.g. `energetica-game`, `energetica-edu`, `energetica-ethz`) |
| **Instance** | A single running game deployment on a server, identified by a kebab-case slug (e.g. `main`, `autumn-2025`) |

Subdomain pattern: `{instance}.{server-domain}` — e.g. `autumn-2025.energetica-game.org`.

The **apex domain always serves the landing page**, never a game instance directly.

### Instance name constraints
- Lowercase kebab-case only (`[a-z0-9][a-z0-9-]*[a-z0-9]`)
- Reserved names: **`landing`** (used for the landing site directory)

### Instance discovery
Canonical source of truth is systemd: `systemctl list-units 'energetica-*.service'`. Filesystem enumeration of `/var/www/energetica-*/` is avoided since it would accidentally include `energetica-landing`.

---

## Architecture

### Request routing (per-instance subdomain)

```
autumn-2025.energetica-game.org
├── /api/*          → ProxyPass → uvicorn :8001
├── /socket.io      → ProxyPass → uvicorn :8001  (+ WS upgrade)
├── /logout         → ProxyPass → uvicorn :8001
├── /static/app/    → Apache serves /var/www/energetica-autumn-2025/energetica/static/app/
├── /static/images/ → Apache serves /var/www/energetica-autumn-2025/energetica/static/images/
├── /static/data/   → Apache serves /var/www/energetica-autumn-2025/energetica/static/data/
├── /service-worker.js → Apache serves from static/
└── /app/*          → FallbackResource → static/app/index.html
```

```
energetica-game.org  (landing — no game backend)
├── /static/landing/ → Apache serves /var/www/energetica-landing/static/landing/
└── /*               → FallbackResource → /var/www/energetica-landing/index.html
```

### What FastAPI keeps

- `/api/v1/*` — REST API
- `/socket.io` — WebSocket
- `/logout` — deletes session cookie, redirects to `/app/login`

Everything else (`StaticFiles` mount, all `FileResponse` page handlers) is removed from FastAPI.

---

## Frontend Split Build

### Route split

| Bundle | Routes |
|--------|--------|
| **Landing** | `/`, `/landing-page`, `/about`, `/for-educators` |
| **App** | `/app/*` (including `/app/sign-up`, moved from top-level `/sign-up`) |

### Directory structure

```
frontend/src/
  routes-landing/         ← new; scanned by landing Vite config
    __root.tsx            ← simple root, no auth, just <Outlet />
    index.tsx             ← redirects / → /landing-page
    landing-page.tsx      ← moved from routes/
    about.tsx             ← moved from routes/
    for-educators.tsx     ← moved from routes/
  routes/                 ← app routes (existing structure, landing files removed)
    __root.tsx            ← auth-aware root (existing, unchanged)
    app/
      sign-up.tsx         ← moved from routes/sign-up.tsx
      login.tsx
      dashboard.tsx
      ...
  main.tsx                ← app entry: full providers (Auth, Socket, GameTick, Query, Theme, Resolution)
  main-landing.tsx        ← new; landing entry: light providers (Theme only)
```

### Vite configs

Two separate config files:

| File | Bundle | `base` | Output dir |
|------|--------|--------|------------|
| `vite.config.ts` | app | `/static/app/` | `energetica/static/app/` |
| `vite.config.landing.ts` | landing | `/` | `frontend/dist-landing/` |

The app build output lives **inside the instance directory** (committed to git, deployed via rsync alongside the backend). The landing build output lives in `frontend/dist-landing/` (gitignored, deployed separately to `/var/www/energetica-landing/`).

### `package.json` scripts

```json
"dev":            "vite",
"dev:landing":    "vite --config vite.config.landing.ts",
"build":          "vite build && bun run build:sw",
"build:landing":  "vite build --config vite.config.landing.ts",
"build:all":      "bun run build && bun run build:landing"
```

---

## Infrastructure Scripts

### New structure

```
scripts/
  infra/
    setup-base.sh             ← run once per server; installs Apache, Python, certbot, firewall, modules
    setup-landing.sh          ← run once per server; creates /var/www/energetica-landing/, main domain vhost
    setup-instance.sh         ← run per instance; usage: setup-instance.sh <instance> <port>
    apache-main.conf          ← main domain vhost template (static landing, no proxy)
    apache-instance.conf      ← instance vhost template (app static + API proxy)
    energetica.service        ← systemd service template
  deploy-landing.sh           ← build:landing → rsync dist-landing/ → server:/var/www/energetica-landing/
  deploy-instance.sh          ← usage: --server <server> --instance <instance>
  list-instances.sh           ← usage: --server <server>; queries systemd, prints name/port/status table
```

`scripts/vps-setup.sh` is superseded by the three `infra/setup-*.sh` scripts and will be removed.

### `deploy-instance.sh` flow

1. Build app bundle (`bun run build`)
2. Validate git is clean (unless `--force`)
3. Confirm deployment summary
4. Verify commits are pushed
5. `git pull` on server (backend code)
6. `rsync` app bundle to server
7. `systemctl restart energetica-{instance}`
8. Health check

### `deploy-landing.sh` flow

1. Build landing bundle (`bun run build:landing`)
2. `rsync dist-landing/` to `server:/var/www/energetica-landing/`

No service restart — landing is pure static.

---

## Migration Steps (single current instance)

The existing `energetica-game.org` instance continues running during migration:

1. Rename build output: `energetica/static/react/` → `energetica/static/app/`
2. Implement split frontend (routes, Vite configs, entry points)
3. Move `/sign-up` → `/app/sign-up`, update all internal links
4. Remove `StaticFiles` mount and all `FileResponse` handlers from FastAPI (`templates.py`)
5. Extract `scripts/infra/` configs, update Apache vhost on server, reload Apache
6. Deploy landing build to `/var/www/energetica-landing/` on server
7. Remove old `scripts/vps-setup.sh`

---

## Deferred / Out of Scope

- **Admin dashboard** — currently stubbed. The server-side role gate in `templates.py` will be dropped along with all other `FileResponse` handlers. A proper frontend route guard and admin UI are a separate workstream.
- **Landing images on multi-server** — landing pages reference images at `/static/images/`. On a server with no game instance (pure landing server), these paths would break. To be addressed when a second server deployment is made.
- **Service worker on multiple instances** — currently scoped to `/`. Per-instance scoping implications (e.g. `autumn-2025.energetica-game.org/service-worker.js`) are not an architectural concern but should be tested when the first subdomain instance goes live.
