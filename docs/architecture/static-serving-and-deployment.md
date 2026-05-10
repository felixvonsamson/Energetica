# RFC: Apache Static Serving, Split Build & Multi-Season Deployment

**Status:** Draft  
**Branch:** `rfc/static-serving-split-build`

---

## Problem

FastAPI currently serves all static files (React bundles, images, game data) by proxying through Apache to uvicorn. Apache should handle static content natively and only forward dynamic traffic (API, WebSocket) to Python. Beyond the performance overhead, the current setup has no path to multi-season deployment and bundles the landing/marketing site into the same JS bundle as the game.

---

## Goals

- Apache serves static files directly from the filesystem
- Split the frontend into two independent bundles: **landing** (public marketing) and **app** (game)
- Support multiple game seasons per server via subdomains
- Formalise server/season terminology and tooling

---

## Rationale: Subdomains vs Subpaths

Game seasons could have been deployed at subpaths (`energetica-game.org/autumn-2025/`) rather than subdomains (`autumn-2025.energetica-game.org`). Subdomains are the right choice for three reasons:

**Password managers** save credentials per origin (scheme + hostname). With subdomains, `autumn-2025.energetica-game.org` and `spring-2026.energetica-game.org` are separate origins — separate credential entries, correct autofill. With subpaths, both seasons share `energetica-game.org` → password manager can't distinguish them → wrong autofill or credential collision.

**localStorage** is also isolated per origin. Subdomains give free, automatic per-season isolation. With subpaths, all seasons share the same `energetica-game.org` localStorage namespace — every key would need an instance-slug prefix throughout the codebase to avoid collisions.

**Session cookies** are the most critical. The session cookie is set with `path="/"` and no explicit domain, so it scopes to the current hostname. With subdomains, season A's session cookie physically cannot be sent to season B. With subpaths, all seasons share `energetica-game.org` cookies — logging into one season leaks the session cookie to all others, a real security problem. Fixing it would require FastAPI to set `path=/autumn-2025/` per season, which the auth system has no concept of.

Subdomains also require less build configuration: subpaths need a per-season Vite `base`, TanStack Router `basepath`, and FastAPI `root_path` — all three layers needing to agree per season. Subdomains need only a new Apache vhost; one build works for all seasons.

---

## Terminology

| Term | Definition |
|------|------------|
| **Server** | A VPS, identified by its SSH alias (e.g. `energetica-game`, `energetica-edu`, `energetica-ethz`) |
| **Season** | A single running game deployment on a server, identified by a kebab-case slug (e.g. `autumn-2025`, `spring-2026`). Also used for private university or business deployments. |

Subdomain pattern: `{season}.{server-domain}` — e.g. `autumn-2025.energetica-game.org`.

The **apex domain always serves the landing page**, never a season directly.

> **Terminology note:** "campaign" and "sim" are strong alternatives to "season" — to be confirmed before the first multi-season deployment.

### Season name constraints
- Lowercase kebab-case only (`[a-z0-9][a-z0-9-]*[a-z0-9]`)
- Reserved names: **`landing`** (used for the landing site directory)

### Season discovery
Canonical source of truth is systemd: `systemctl list-units 'energetica-*.service'`. Filesystem enumeration of `/var/www/energetica-*/` is avoided since it would accidentally include `energetica-landing`.

---

## Architecture

### Request routing (per-season subdomain)

```
autumn-2025.energetica-game.org
├── /api/*             → ProxyPass → uvicorn :8001
├── /socket.io         → ProxyPass → uvicorn :8001  (+ WS upgrade)
├── /logout            → ProxyPass → uvicorn :8001
├── /static/app/       → Apache serves energetica/static/app/
├── /static/images/    → Apache serves energetica/static/images/
├── /static/data/      → Apache serves energetica/static/data/
├── /service-worker.js → Apache serves energetica/static/service-worker.js
├── /manifest.json     → Apache serves energetica/static/app/manifest.json  (PWA, per-season)
├── /                  → RedirectMatch ^/$ → /app/   (bare root → React router takes over)
└── /app/*             → FallbackResource → energetica/static/app/index.html
```

`manifest.json` is part of the app bundle output and must be served at the root path (PWA requirement). Apache aliases it explicitly. It is per-season because the PWA manifest may eventually carry season-specific metadata (name, scope, icons).

```
energetica-game.org  (landing — DocumentRoot /var/www/energetica-landing/, no game backend)
└── /*  → FallbackResource → index.html  (SPA routing for /landing-page, /about, /for-educators, /wiki/*, /changelog)
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
| **Landing** | `/`, `/landing-page`, `/about`, `/for-educators`, `/wiki/$slug`, `/changelog` |
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
    wiki/
      index.tsx           ← redirects /wiki → /wiki/introduction
      $slug.tsx           ← same MDX glob as app wiki; auth-unaware layout
    changelog.tsx         ← same MDX content as app changelog; auth-unaware layout
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

`vite.config.landing.ts` needs the same `@mdx-js/rollup` plugin configuration as `vite.config.ts` (remark-gfm, remark-math, rehype-katex, rehype-slug). The landing wiki and changelog use auth-unaware layout components; `wiki-layout.tsx` imports `GameLayout` and `useAuth` and cannot be used directly in the landing bundle.

### Vite configs

Two separate config files:

| File | Bundle | `base` | Output dir |
|------|--------|--------|------------|
| `vite.config.ts` | app | `/static/app/` | `energetica/static/app/` |
| `vite.config.landing.ts` | landing | `/` | `frontend/dist-landing/` |

Both build outputs are **gitignored** and deployed via rsync:

| Bundle | Output dir | Gitignored | Deployed to |
|--------|-----------|------------|-------------|
| app | `energetica/static/app/` | yes | `server:/var/www/energetica-{season}/energetica/static/app/` |
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
    setup-season.sh           ← run per season; usage: setup-season.sh <season> <port>
    apache-main.conf          ← main domain vhost template (static landing, no proxy)
    apache-season.conf        ← season vhost template (app static + API proxy)
    energetica.service        ← systemd service template
  deploy-landing.sh           ← build:landing → rsync dist-landing/ → server:/var/www/energetica-landing/
  deploy-season.sh            ← usage: --server <server> --season <season>
  list-seasons.sh             ← usage: --server <server>; queries systemd, prints name/port/status table
```

`scripts/vps-setup.sh` is superseded by the three `infra/setup-*.sh` scripts and will be removed.

### `setup-season.sh` flow

1. Create `/var/www/energetica-{season}/` directory structure
2. Clone repo (or symlink shared code — TBD)
3. Create and enable Apache vhost from `apache-season.conf` template
4. Reload Apache (HTTP only at this point)
5. Obtain TLS certificate: `certbot certonly --webroot -w /var/www/html -d {season}.{domain}`
6. Update vhost with SSL directives, reload Apache
7. Install certbot deploy hook to reload Apache on certificate renewal
8. Create and enable `energetica-{season}.service` systemd unit
9. `pip install -r requirements.txt`, start service

TLS provisioning (steps 5–7) requires the DNS record for `{season}.{domain}` to already resolve to the server before running.

### `deploy-season.sh` flow

1. Build app bundle (`bun run build`)
2. Confirm deployment summary (skipped with `--yes`)
3. `rsync` Python backend code to server (excluding `.venv`, `season/`, build artifacts)
4. `rsync` app bundle to server (`energetica/static/app/`)
5. `rsync` service worker to server (`energetica/static/service-worker.js` — built separately by `build:sw`, lives outside the app bundle directory)
6. `pip install -r requirements.txt` on server if dependencies changed
7. `systemctl restart energetica-{season}`
8. Health check

Scripts accept all inputs via arguments or env vars and support `--yes` to suppress confirmation prompts, making them callable from a CI job without modification. No commitment to a CI platform is made here.

### `deploy-landing.sh` flow

1. Build landing bundle (`bun run build:landing`)
2. `rsync dist-landing/` to `server:/var/www/energetica-landing/`

No service restart — landing is pure static.

---

## Deferred / Out of Scope

- **CI/CD** — deployment is via local scripts for now. Scripts are CI-compatible by design (all inputs via args/env vars, `--yes` flag, deterministic exit codes). Wiring to GitHub Actions or equivalent is a future decision.
- **Admin dashboard** — currently stubbed. The server-side role gate in `templates.py` will be dropped along with all other `FileResponse` handlers. A proper frontend route guard and admin UI are a separate workstream.
- **Landing images on multi-server** — landing pages reference images at `/static/images/`. On a server with no game instance (pure landing server), these paths would break. To be addressed when a second server deployment is made.
- **Service worker on multiple seasons** — currently scoped to `/`. Per-season scoping implications (e.g. `autumn-2025.energetica-game.org/service-worker.js`) are not an architectural concern but should be tested when the first subdomain season goes live.
