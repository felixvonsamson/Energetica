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
├── /api/*             → ProxyPass → uvicorn :8001
├── /socket.io         → ProxyPass → uvicorn :8001  (+ WS upgrade)
├── /logout            → ProxyPass → uvicorn :8001
├── /static/app/       → Apache serves energetica/static/app/
├── /static/images/    → Apache serves energetica/static/images/
├── /static/data/      → Apache serves energetica/static/data/
├── /service-worker.js → Apache serves energetica/static/service-worker.js
├── /manifest.json     → Apache serves energetica/static/app/manifest.json  (PWA, per-instance)
├── /                  → RedirectMatch ^/$ → /app/   (bare root → React router takes over)
└── /app/*             → FallbackResource → energetica/static/app/index.html
```

`manifest.json` is part of the app bundle output and must be served at the root path (PWA requirement). Apache aliases it explicitly. It is per-instance because the PWA manifest may eventually carry instance-specific metadata (name, scope, icons).

```
energetica-game.org  (landing — DocumentRoot /var/www/energetica-landing/, no game backend)
└── /*  → FallbackResource → index.html  (SPA routing for /landing-page, /about, /for-educators)
```

The landing vhost uses `DocumentRoot /var/www/energetica-landing/`. With `base: "/"`, Vite emits assets at `/assets/index-abc123.js`; Apache serves them directly from DocumentRoot. No Alias needed.

### What FastAPI keeps

- `/api/v1/*` — REST API
- `/socket.io` — WebSocket
- `/logout` — deletes session cookie, redirects to `/app/login`

Everything else (`StaticFiles` mount, all `FileResponse` page handlers) is removed from FastAPI.

`energetica/static/apple-app-site-association` is also removed — it is legacy and no longer used.

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

Both build outputs are **gitignored** and deployed via rsync:

| Bundle | Output dir | Gitignored | Deployed to |
|--------|-----------|------------|-------------|
| app | `energetica/static/app/` | yes | `server:/var/www/energetica-{instance}/energetica/static/app/` |
| landing | `frontend/dist-landing/` | yes | `server:/var/www/energetica-landing/` |

`.gitignore` must be updated: replace `energetica/static/react/*` with `energetica/static/app/*` and add `frontend/dist-landing/`.

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
2. Confirm deployment summary (skipped with `--yes`)
3. `rsync` Python backend code to server (excluding `.venv`, `instance/`, build artifacts)
4. `rsync` app bundle to server
5. `pip install -r requirements.txt` on server if dependencies changed
6. `systemctl restart energetica-{instance}`
7. Health check

Scripts accept all inputs via arguments or env vars and support `--yes` to suppress confirmation prompts, making them callable from a CI job without modification. No commitment to a CI platform is made here.

### `deploy-landing.sh` flow

1. Build landing bundle (`bun run build:landing`)
2. `rsync dist-landing/` to `server:/var/www/energetica-landing/`

No service restart — landing is pure static.

---

## Migration Steps (single current instance)

The existing `energetica-game.org` instance continues running during migration:

1. Update `.gitignore`: replace `energetica/static/react/*` → `energetica/static/app/*`, add `frontend/dist-landing/`
2. Rename build output: `energetica/static/react/` → `energetica/static/app/`
3. Implement split frontend (routes, Vite configs, entry points)
4. Move `/sign-up` → `/app/sign-up`, update all internal links
5. Remove `StaticFiles` mount and all `FileResponse` handlers from FastAPI (`templates.py`)
6. Delete `energetica/static/apple-app-site-association`
7. Extract `scripts/infra/` configs, update Apache vhost on server, reload Apache
8. Deploy landing build to `/var/www/energetica-landing/` on server
9. Remove old `scripts/vps-setup.sh`

---

---

## Deferred / Out of Scope

- **CI/CD** — deployment is via local scripts for now. Scripts are CI-compatible by design (all inputs via args/env vars, `--yes` flag, deterministic exit codes). Wiring to GitHub Actions or equivalent is a future decision.
- **Admin dashboard** — currently stubbed. The server-side role gate in `templates.py` will be dropped along with all other `FileResponse` handlers. A proper frontend route guard and admin UI are a separate workstream.
- **Landing images on multi-server** — landing pages reference images at `/static/images/`. On a server with no game instance (pure landing server), these paths would break. To be addressed when a second server deployment is made.
- **Service worker on multiple instances** — currently scoped to `/`. Per-instance scoping implications (e.g. `autumn-2025.energetica-game.org/service-worker.js`) are not an architectural concern but should be tested when the first subdomain instance goes live.
