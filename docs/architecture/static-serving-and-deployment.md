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
- Server-wide accounts: one set of credentials works on every season on a given server
- Per-season visibility and access policy: some seasons are publicly advertised, others are private (unlisted and/or allowlist-gated)
- No singleton backend on the apex domain — the landing remains pure-static

---

## Rationale: Subdomains vs Subpaths

Game seasons could have been deployed at subpaths (`energetica-game.org/autumn-2025/`) rather than subdomains (`autumn-2025.energetica-game.org`). Subdomains are the right choice for three reasons:

**Password managers** save credentials per origin (scheme + hostname). With subdomains, `autumn-2025.energetica-game.org` and `spring-2026.energetica-game.org` are separate origins — separate credential entries, correct autofill. With subpaths, both seasons share `energetica-game.org` → password manager can't distinguish them → wrong autofill or credential collision.

**localStorage** is also isolated per origin. Subdomains give free, automatic per-season isolation. With subpaths, all seasons share the same `energetica-game.org` localStorage namespace — every key would need an instance-slug prefix throughout the codebase to avoid collisions.

**Session cookies** are the most critical. The session cookie is set with `path="/"` and no explicit domain, so it scopes to the current hostname. With subdomains, season A's session cookie physically cannot be sent to season B. With subpaths, all seasons share `energetica-game.org` cookies — logging into one season leaks the session cookie to all others, a real security problem. Fixing it would require FastAPI to set `path=/autumn-2025/` per season, which the auth system has no concept of.

Subdomains also require less build configuration: subpaths need a per-season Vite `base`, TanStack Router `basepath`, and FastAPI `root_path` — all three layers needing to agree per season. Subdomains need only a new Apache vhost; one build works for all seasons.

> **On shared credentials.** Server-wide accounts (introduced in [Server-Wide Accounts](#server-wide-accounts)) do **not** undo the cookie-isolation argument above. Credentials are shared via a server-side SQLite file; sessions are still per-subdomain. A user re-enters their password on each season they visit and gets an independent session cookie for that origin. The cookie-leak class of bug remains structurally impossible.

---

## Terminology

| Term | Definition |
|------|------------|
| **Server** | A VPS, identified by its SSH alias (e.g. `energetica-game`, `energetica-edu`, `energetica-ethz`) |
| **Season** | A single running game deployment on a server, identified by a kebab-case slug (e.g. `autumn-2025`, `spring-2026`). Also used for private university or business deployments. |
| **Account** | A server-wide identity. One row in the server's `accounts.db` SQLite file, keyed by `account_id`. Holds credentials (`username`, `pwhash`, optional `email`). Independent of any season. |
| **User** (pickle) | A per-season record in the engine pickle (`energetica/database/user.py`), keyed by a local AutoIDDict id. Carries `account_id` as a foreign key to the server-wide account. Auto-provisioned on first successful login to a season. |
| **Player** | The game-side state of a user who has completed the settle flow. Distinct from `User`: a `User` may exist without a `Player`. |

Subdomain pattern: `{season}.{server-domain}` — e.g. `autumn-2025.energetica-game.org`.

The **apex domain always serves the landing page**, never a season directly.

> **Terminology note:** "campaign" and "sim" are strong alternatives to "season" — to be confirmed before the first multi-season deployment.

### Season name constraints
- Lowercase kebab-case only (`[a-z0-9][a-z0-9-]*[a-z0-9]`)
- Reserved names: **`landing`** (used for the landing site directory)

### Username constraints
- Globally unique per server (enforced by `accounts.username UNIQUE` in SQLite)
- Per-server scope only; the same username on `energetica-game` and `energetica-edu` are unrelated accounts

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
├── /seasons.json         → Apache serves /var/www/energetica-landing/seasons.json  (manifest, Cache-Control: max-age=60)
├── /seasons/{slug}.json  → Apache serves /var/www/energetica-landing/seasons/{slug}.json  (per-season public fragment)
└── /*                    → FallbackResource → index.html  (SPA routing for /landing-page, /about, /for-educators, /wiki/*, /changelog)
```

The landing vhost uses `DocumentRoot /var/www/energetica-landing/`. With `base: "/"`, Vite emits assets at `/assets/index-abc123.js`; Apache serves them directly from DocumentRoot. No Alias needed.

The `seasons.json` manifest and `seasons/` fragment directory are populated by the season backends themselves (see [Season Visibility & Access](#season-visibility--access)); the apex domain hosts no application logic.

### What FastAPI keeps

- `/api/v1/*` — REST API
- `/socket.io` — WebSocket
- `/logout` — deletes session cookie, redirects to `/app/login`

Everything else (`StaticFiles` mount, all `FileResponse` page handlers) is removed from FastAPI.

`energetica/static/apple-app-site-association` is also removed — it is legacy and no longer used.

### What FastAPI gains

- Reads `/var/lib/energetica/accounts.db` (shared SQLite) on signup, login, and password change.
- Reads its own `/var/www/energetica-{season}/season.json` on every login attempt for access-policy enforcement (no in-memory cache — admin edits take effect on the next login).
- Writes its own sanitised fragment to `/var/www/energetica-landing/seasons/{slug}.json` on process start and whenever `season.json` is reloaded (see [Season Visibility & Access](#season-visibility--access)). Writes are atomic (write-to-tmp + rename).

---

## Server-Wide Accounts

### Model

Credentials are server-wide; sessions remain per-subdomain. One physical SQLite file on the VPS holds the canonical identity:

```
/var/lib/energetica/accounts.db

  accounts(
    account_id   INTEGER PRIMARY KEY,
    username     TEXT    NOT NULL UNIQUE,
    email        TEXT             UNIQUE,   -- nullable for now; not yet collected in the signup form
    pwhash       TEXT    NOT NULL,
    created_at   TEXT    NOT NULL           -- ISO-8601 UTC
  )
```

The pickle `User` (`energetica/database/user.py`) gains an `account_id: int` field, used as the foreign key back to SQLite. The pickle keeps its own local AutoIDDict id; the two ids differ and must not be conflated.

SQLite is opened by every season backend with WAL mode (concurrent readers, serialised writers). Writes are infrequent (signup, password change) and short.

### Flows

**Signup.** Only available on season subdomains, never on the apex. The landing's signup CTA links to the latest advertised season's `/app/sign-up` (selection rule: filename-sorted first entry in `seasons.json`; revisited when a richer picker UI lands — see [Deferred / Out of Scope](#deferred--out-of-scope)). Signup writes one row to SQLite `accounts` and one row to that season's pickle `User`, in a single logical transaction (SQLite first; on failure of the pickle write, the SQLite row is rolled back).

**Login on the original signup season.** Backend looks up `accounts` by `username`, verifies `pwhash`. On success, finds the matching pickle `User` by `account_id` and sets the session cookie.

**Login on a different season (first time).** Same SQLite check. Then the season's access policy is consulted (see below). If allowed, the backend auto-provisions a pickle `User(account_id, role="player", player=None)` in its own engine and proceeds. No `Player` is created — that still happens at the settle page, which serves as the real "join this season" confirmation.

**Logout.** Unchanged; clears the session cookie for the current subdomain only.

**Password change.** Writes the new `pwhash` to SQLite. Other seasons see the change on their next login attempt automatically (they read SQLite, not their pickle, for credentials).

### Why credentials shared but sessions not

Per-subdomain cookie isolation is preserved as a security property (see [Rationale: Subdomains vs Subpaths](#rationale-subdomains-vs-subpaths)). Sharing the *credentials store* is what users actually want ("one account on the site"); sharing *sessions* across subdomains would require a parent-domain cookie and reintroduce the cross-season cookie-leak class of bug. The cost of the chosen design is a second password prompt when a user first visits a new season — accepted as worth the security simplification.

---

## Season Visibility & Access

Two independent axes per season:

- **Advertised vs unadvertised.** Whether the landing's season picker lists it.
- **Public vs private.** Whether any server-wide account may log in, or only those on an allowlist.

Both axes are declared per-season in a single file the season backend owns:

```
/var/www/energetica-{slug}/season.json

  Public + advertised:
    { "name": "Autumn 2025", "advertised": true,  "access": { "policy": "public" } }

  Private (allowlist-gated) + unadvertised:
    { "name": "ETHZ Spring 2026", "advertised": false,
      "access": { "policy": "private", "allowed_usernames": ["alice", "bob"] } }
```

`slug` is **not** stored in the file — it is the deploy directory name (canonical per [Season discovery](#season-discovery)). Subdomain is **not** stored either — the landing composes `${slug}.${apex}` at render time, where `apex` is a Vite build-time constant.

The file is re-read on every login attempt. There is no in-memory cache. Admin edits take effect on the next login with no restart and no SIGHUP.

### Publication to the landing

Each season process, on start and whenever it reloads `season.json`, writes a **sanitised fragment** to the landing dir:

```
/var/www/energetica-landing/seasons/{slug}.json

  { "slug": "autumn-2025", "name": "Autumn 2025", "advertised": true }
```

The `access` block (including `allowed_usernames`) is **stripped before write** — the landing dir is served statically by Apache, and any allowlist that reached it would leak to the internet.

Writes are atomic: write to `{slug}.json.tmp` then `rename(2)` over the target. No locking required across season processes since each writes to a unique filename.

After writing its fragment, the season process runs the inline aggregation step:

```bash
jq -s '{seasons: .}' /var/www/energetica-landing/seasons/*.json \
  > /var/www/energetica-landing/seasons.json.tmp \
  && mv /var/www/energetica-landing/seasons.json.tmp \
        /var/www/energetica-landing/seasons.json
```

Two concurrent aggregations may interleave; last-writer-wins is harmless because every aggregator reads the same fragment dir and produces a complete snapshot. The atomic rename guarantees readers never see a partial file.

### Frontend consumption

The landing fetches `/seasons.json` and renders advertised entries. Apache serves it with `Cache-Control: max-age=60` so admin changes propagate within a minute without explicit cache-busting.

Unadvertised seasons that are public are reachable by direct URL — a user who knows the subdomain may sign up and play. Unadvertised + private seasons are reachable only by URL *and* require allowlisted credentials.

### Operational notes

- The landing's `seasons/` subdirectory must be writable by every season's systemd unit. Cleanest: create a shared group `energetica`, `chmod g+ws /var/www/energetica-landing/seasons/`, and run each `energetica-{slug}.service` as a user in that group. Setgid ensures new fragment files inherit group ownership.
- A season going down does not currently remove its fragment. If permanent removal is desired, `teardown-season.sh` deletes the fragment and re-runs the aggregation. Stale fragments for stopped-but-not-removed seasons are tolerated — the landing UI can surface `status` later (deferred per [7a](#deferred--out-of-scope)).
- No cross-season reads. Each season reads only its own `season.json`. The aggregation step reads only files inside the landing-owned `seasons/` dir.

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
    setup-base.sh             ← run once per server; installs Apache, Python, certbot, firewall, modules;
                                creates /var/lib/energetica/ and accounts.db; creates `energetica` group
    setup-landing.sh          ← run once per server; creates /var/www/energetica-landing/, main domain vhost;
                                creates /var/www/energetica-landing/seasons/ with setgid `energetica`
    setup-season.sh           ← run per season; usage: setup-season.sh <season> <port>;
                                also writes initial season.json
    apache-main.conf          ← main domain vhost template (static landing, no proxy)
    apache-season.conf        ← season vhost template (app static + API proxy)
    energetica.service        ← systemd service template (runs as user in `energetica` group)
    season.json.tmpl          ← initial per-season config; default policy is public, advertised true
  deploy-landing.sh           ← build:landing → rsync dist-landing/ → server:/var/www/energetica-landing/
  deploy-season.sh            ← usage: --server <server> --season <season>;
                                rsyncs season.json if changed; restart triggers fragment + aggregation rewrite
  list-seasons.sh             ← usage: --server <server>; queries systemd, prints name/port/status table
  migrate-to-server-accounts.py  ← one-time per VPS; backfills accounts.db from the existing season's pickle
                                   and writes account_id into each pickle User row
```

`scripts/vps-setup.sh` is superseded by the three `infra/setup-*.sh` scripts and will be removed.

### `setup-season.sh` flow

1. Create `/var/www/energetica-{season}/` directory structure
2. Clone repo (or symlink shared code — TBD)
3. Render `season.json.tmpl` into `/var/www/energetica-{season}/season.json` (defaults: `name = {slug titlecased}`, `advertised = true`, `access.policy = "public"` — admin edits before going live for private seasons)
4. Create and enable Apache vhost from `apache-season.conf` template
5. Reload Apache (HTTP only at this point)
6. Obtain TLS certificate: `certbot certonly --webroot -w /var/www/energetica-{season}/ -d {season}.{domain}` — the season directory (created in step 1) is already the Apache DocumentRoot, so ACME challenge files are reachable there
7. Update vhost with SSL directives, reload Apache
8. Install certbot deploy hook to reload Apache on certificate renewal
9. Create and enable `energetica-{season}.service` systemd unit (runs as a user in group `energetica` so it can write fragments to the landing's `seasons/` dir)
10. `pip install -r requirements.txt`, start service — on startup the season writes its sanitised fragment to `/var/www/energetica-landing/seasons/{season}.json` and runs the aggregation step

TLS provisioning (steps 6–8) requires the DNS record for `{season}.{domain}` to already resolve to the server before running.

### `deploy-season.sh` flow

1. Build app bundle (`bun run build`)
2. Confirm deployment summary (skipped with `--yes`)
3. `rsync` Python backend code to server (excluding `.venv`, `season/`, build artifacts, and `season.json` — that file is admin-owned on the server and must not be overwritten by deploys)
4. `rsync` app bundle to server (`energetica/static/app/`)
5. `rsync` service worker to server (`energetica/static/service-worker.js` — built separately by `build:sw`, lives outside the app bundle directory)
6. `pip install -r requirements.txt` on server if dependencies changed
7. `systemctl restart energetica-{season}` — on restart the season re-publishes its fragment and re-runs aggregation, picking up any admin edits to `season.json` made since the last start
8. Health check

Scripts accept all inputs via arguments or env vars and support `--yes` to suppress confirmation prompts, making them callable from a CI job without modification. No commitment to a CI platform is made here.

### `deploy-landing.sh` flow

1. Build landing bundle (`bun run build:landing`)
2. `rsync dist-landing/` to `server:/var/www/energetica-landing/`

No service restart — landing is pure static. `seasons.json` and `seasons/` are not touched — they are owned by the season backends and must not be overwritten.

### `migrate-to-server-accounts.py` flow

Run once per VPS, before the first deploy that ships server-wide accounts. Idempotent guard: skips any `User` row that already carries an `account_id` (per-user check, not a whole-DB check), so a partial failure can be recovered by simply re-running the script.

1. Stop the season service (`systemctl stop energetica-{season}`) to prevent concurrent pickle mutation
2. Load the existing engine pickle (`/var/www/energetica-{season}/instance/engine_data.pck`)
3. For each `User` in the engine's user table:
   - Insert a row into `accounts.db`: `(username, pwhash, NULL, now())` → returns `account_id`
   - Write `account_id` back into the pickle `User`
4. Save the modified pickle
5. Restart the season service

Today there is exactly one season per VPS, so no cross-season username collisions are possible during migration. If multiple seasons ever exist before this migration runs (e.g. on a new server that bootstrapped multi-season before accounts were unified), the script must be re-thought.

---

## Deferred / Out of Scope

- **CI/CD** — deployment is via local scripts for now. Scripts are CI-compatible by design (all inputs via args/env vars, `--yes` flag, deterministic exit codes). Wiring to GitHub Actions or equivalent is a future decision.
- **Admin dashboard** — currently stubbed. The server-side role gate in `templates.py` will be dropped along with all other `FileResponse` handlers. A proper frontend route guard and admin UI are a separate workstream.
- **Landing images on multi-server** — landing pages reference images at `/static/images/`. On a server with no game instance (pure landing server), these paths would break. To be addressed when a second server deployment is made.
- **Service worker on multiple seasons** — currently scoped to `/`. Per-season scoping implications (e.g. `autumn-2025.energetica-game.org/service-worker.js`) are not an architectural concern but should be tested when the first subdomain season goes live.
- **`seasons.json` schema expansion** — current minimum is `{slug, name, advertised}`. Fields like `description`, `status`, `starts_at`, `ends_at`, `thumbnail` will be added when a season-picker UI needs them (YAGNI until then).
- **Season-picker UI** — landing currently sends the signup CTA to the latest advertised season. Lateral navigation between active seasons (a picker page or persistent header element — UI form factor TBD) is a frontend workstream that consumes the existing `seasons.json` data and may motivate schema additions above.
- **Password reset via email** — `accounts.email` is in the SQLite schema (nullable, unique) but not yet collected at signup. Adding the signup field and the reset-by-email flow (which requires an SMTP/transactional-mail dependency the project does not yet have) is a follow-up.
- **`teardown-season.sh`** — removing a season cleanly (delete vhost, disable service, delete fragment, re-aggregate, optionally archive pickle) is not yet scripted. Stale fragments for stopped seasons are tolerated until then.
- **Cross-server accounts** — accounts are scoped to a single VPS. The same username on `energetica-game` and `energetica-edu` are unrelated. Unifying identity across servers would require either a remote auth service or replication and is explicitly out of scope.
