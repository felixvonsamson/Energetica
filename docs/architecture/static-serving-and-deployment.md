# RFC: Apache Static Serving, Split Build & Multi-Instance Deployment

**Status:** In progress (Phases 1–5 landed; only Phase 6 — live multi-instance validation — remains)
**Branch:** `rfc/static-serving-split-build`

---

## Implementation Status

Shipping in phased PRs. Each phase leaves the app deployable on its own.

- ✅ **Phase 1 — Frontend split build**
  - Renamed `energetica/static/react/` → `energetica/static/app/` (Vite output, `base`, FastAPI `FileResponse` paths, `deploy.sh`, `.gitignore`)
  - Added `frontend/src/routes-landing/`, `vite.config.landing.ts`, `main-landing.tsx`, `index.landing.html`, `tsconfig.landing.json`; `dist-landing/` gitignored
  - Extracted `about-page.tsx`, `for-educators-page.tsx`, `wiki-layout-public.tsx` so landing and app share content without sharing auth-bound layouts
  - Moved `/sign-up` → `/app/sign-up`; updated in-app `Link to="/sign-up"`
  - Dropped dead `/admin-dashboard` FastAPI route and legacy `apple-app-site-association`
  - **Side-by-side decision:** landing routes still live in `routes/` (duplicated as thin shells) during the interim. The app bundle still serves them via FastAPI; Phase 5 deletes them when Apache takes over.
- ✅ **Phase 2 — Server-wide accounts.**
  - Added `energetica/accounts/` package (SQLite store, WAL, lazy schema bootstrap, `ENERGETICA_ACCOUNTS_DB_PATH` env var, default `/var/lib/energetica/accounts.db`)
  - Added `account_id: int` (required) to pickle `User`; `__setstate__` raises a clear error if missing on unpickle (forces the migration script to run before the new code starts)
  - Refactored signup/login/change-password (`energetica/routers/auth.py`, `energetica/utils/misc.py`): credentials are written to and read from SQLite as the source of truth; the pickle `pwhash` is kept in sync as a non-load-bearing mirror
  - Signup uses SQLite-row-first + pickle-row-second with rollback (`accounts.delete_account`) if the pickle write fails
  - Login auto-provisions a pickle `User(account_id, role="player", player=None)` on first visit to an instance — full access-policy gating lands in Phase 3 (current behaviour: treat every instance as `public`)
  - `scripts/migrate-to-server-accounts.py` (idempotent via `INSERT OR IGNORE` + `SELECT`)
- ✅ **Phase 3 — Instance visibility & access policy.**
  - Added `energetica/instance_config.py`: reads `{ENERGETICA_INSTANCE_CONFIG_DIR}/{slug}/instance.json` (default dir `/etc/energetica`) fresh on every login/signup (no cache); slug + dirs are env-configurable (`ENERGETICA_INSTANCE_SLUG`, `ENERGETICA_INSTANCE_CONFIG_DIR`, `ENERGETICA_LANDING_DIR`) for hermetic tests
  - `auth.py` login **and** signup now enforce the access policy after the credential check: `public` (or unconfigured) allows any account; `private` allows only `allowed_usernames`. Denied → `403 INSTANCE_ACCESS_DENIED`. Gating signup too closes the hole where a private/unadvertised instance reachable by URL would otherwise let anyone create a server-wide account
  - On startup and on each allowed login, publishes the sanitised fragment (the `access` block stripped) to `{landing}/instances/{slug}.json` via atomic temp-write + `os.replace`, then re-aggregates `{landing}/instances.json` sorted by `starts_at` desc. Best-effort: a publish failure (e.g. unwritable landing dir) is logged and never breaks login
  - The aggregate `instances.json` lists **only advertised** instances. A slug *is* a subdomain, and `instances.json` is world-readable, so emitting an unadvertised slug there would let anyone enumerate an otherwise-hidden instance. Unadvertised instances keep their on-disk fragment (reachable only by already knowing the slug) but never appear in the public manifest — a refinement of the RFC's original "frontend filters advertised entries" approach, moved server-side for defence in depth
  - Frontend (landing bundle): `useAdvertisedInstances()` + `AdvertisedRuns` fetch `/instances.json` and render advertised entries; the signup CTA links to each instance's `/app/sign-up` (`${slug}.${VITE_APEX_DOMAIN}` when the apex is set, same-origin relative in the interim). Degrades to nothing when no manifest is served yet
  - **Implementation choice** (identical observable output to the spec): aggregation is pure Python rather than a `jq` subprocess — testable, no runtime `jq` dependency on the login path, same `{instances: [...]}` shape sorted `starts_at` desc. Each `instances.json`/fragment write uses a unique `mkstemp` tmp file so two instance processes aggregating concurrently can't clobber a shared tmp mid-write
  - **Security choices:** (a) an absent `instance.json` reads as `public` (preserves the Phase-2 default and dev/test behaviour), but a present-but-unparseable file **fails closed** (`403`) rather than silently granting public access — this includes a half-edited config (a stray key inside the `access` block, via `extra="forbid"`); (b) `starts_at` must be timezone-aware (naive → fail closed), which also guarantees the aggregation sort never mixes naive/aware datetimes
  - Published files are written group-readable (`os.chmod(tmp_name, 0o640)` before the atomic rename): `mkstemp` forces `0o600`, but Apache (`www-data`, in the shared `energetica` group) must read them to serve the landing manifest. `0o640` rather than `0o644` keeps the on-disk file non-world-readable
  - **Known limitation (private instances):** access is gated purely on the `allowed_usernames` allowlist with no role bypass, so the auto-provisioned `admin` account is locked out of a `private` instance unless explicitly listed. Acceptable while the focus is public instances; private-instance administration (admin bypass vs. listing admins explicitly) is one of the design decisions deferred with the rest of the private/unadvertised work
  - **Follow-up (not done here):** the existing global `disable_signups` + `players.txt` mechanism and the new private-allowlist policy overlap. They compose (the `disable_signups` check runs first), but unifying them — a private+allowlist instance subsuming `players.txt` — has migration implications and is deferred
- ✅ **Phase 4 — Apache configs + infra scripts.**
  - `scripts/infra/`: `apache-instance.conf` + `apache-main.conf` (placeholder templates rendered with `sed`; `@INSTANCE@`/`@PORT@`/`@DOMAIN@`), `energetica.service` (systemd template), `instance.json.tmpl`, and the setup scripts `setup-base.sh`, `setup-landing.sh`, `setup-instance.sh`
  - `scripts/` root: `deploy-instance.sh`, `deploy-landing.sh`, `list-instances.sh`. `scripts/vps-setup.sh` removed (superseded). `deploy.sh` and the FastAPI static handlers are left for the Phase 5 cutover
  - **Server-side code delivery: rsync, no git (decided this phase).** `setup-instance.sh` provisions the box (dir, venv, `/etc/energetica/{slug}/instance.json`, vhost+TLS, enabled-but-unstarted unit) but ships **no** code; the first `deploy-instance.sh` rsyncs the backend, `pip install`s into the server venv, and starts the service. This matches the RFC's "rsync Python backend code" deploy step and removes deploy credentials/git from the server entirely — resolves the `setup-instance.sh` step-2 TBD (clone vs symlink) in favour of neither
  - **systemd unit sets the full Phase-3 env contract** (`ENERGETICA_INSTANCE_SLUG` mandatory, plus `_CONFIG_DIR`/`_LANDING_DIR`/`_ACCOUNTS_DB_PATH`). Services run as the shared `energetica` user/group; the landing root and its `instances/` dir are `setgid energetica` + group-writable so any instance can publish its fragment and rewrite `instances.json`, and `www-data` joins the group to read the `0o640` fragments. `apache-instance.conf` serves `/static/{app,images,data}`, `/service-worker.js`, `/manifest.json` (aliased to the app bundle) directly, redirects `^/$ → /app/`, scopes the SPA `FallbackResource` to `/app/*` (so a missing hashed asset 404s cleanly instead of returning `index.html` with a `200`), and proxies only `/api`, `/socket.io` (+ WS upgrade), `/logout`
  - `instance.json.tmpl` renders the exact `InstanceConfig` schema (`name` titlecased slug, `advertised=true`, `starts_at`=now UTC `…Z`, `access.policy="public"`); the `--name`/`--starts-at` values are sed-metachar-escaped and JSON-breaking chars rejected so the rendered file always validates. Admins edit it under `sudo` for private/unadvertised instances. `list-instances.sh` discovers instances via `systemctl list-unit-files 'energetica-*.service'` (never filesystem globbing), reading the port from each unit's `ExecStart`
  - `setup-base.sh` also installs a scoped `sudoers` drop-in so the deploy user can run `sudo -u energetica pip …` and `sudo systemctl restart energetica-*` non-interactively (required by `deploy-instance.sh`)
  - **Validation:** `bash -n` clean on all six scripts. `shellcheck`/`apache2ctl`/`certbot` are unavailable in the dev sandbox, and end-to-end validation (real subdomain, cookie isolation, fragment round-trip) is **Phase 6**; live-checking the confs on a server is part of that
- ✅ **Phase 5 — FastAPI cleanup + production cutover.**
  - `templates.py` reduced to `/logout` only; `render_root` (`/`), `render_react_app` (`/app/*`), `render_landing_page` (`/landing-page`) and the `/sign-up` 301 removed. `__init__.py` drops the `StaticFiles` mount and the `serve_service_worker` (`/service-worker.js`) + `serve_manifest` (`/manifest.json`) `FileResponse` handlers — Apache now serves all three. FastAPI keeps only `/api`, `/socket.io`, `/logout` (plus `/healthz`)
  - **Frontend landing/app split completed.** Deleted the app-bundle landing duplicates `routes/{route.tsx (`/`), landing-page.tsx, about.tsx, for-educators.tsx}`. The app's non-game pages (login, sign-up, unauthenticated changelog, `internal/*`) moved off the shared marketing `HomeLayout` onto a new `components/layout/app-shell.tsx` (logo + theme toggle, no marketing nav). The marketing `header.tsx`/`footer.tsx`/`home-layout.tsx`/`landing-page.tsx`/`about-page.tsx`/`for-educators-page.tsx` are now **landing-only** and excluded from the app `tsconfig.json` (mirroring the existing `wiki-*-public` exclusions), so their `Link to="/landing-page"` keeps type-checking under the landing's loose router types while the app tree no longer carries those routes
  - **Cross-origin links.** Added `landingHref()` (`lib/instances.ts`), the mirror of `instanceSignupHref()`: app→landing links (the two "Learn more about Energetica" links) become `<a href>` to `https://${apex}/landing-page` in production, same-origin relative in dev. `deploy-instance.sh` and `deploy-landing.sh` now bake `VITE_APEX_DOMAIN="$DOMAIN"` into their builds (the latter gained a required `--domain`); without it both `landingHref` and `instanceSignupHref` would emit same-origin paths that 404 across the apex/subdomain boundary
  - **Scripts.** Deleted the legacy single-instance `deploy.sh` and `verify-deploy.sh` (superseded by `deploy-instance.sh` + its `/healthz` poll). `download-instance.sh` is now instance-aware (`--server`/`--instance`, backs up `/var/www/energetica-{slug}/instance/`). `apache-instance.conf` gains `RedirectMatch ^/sign-up/?$ /app/sign-up` as an instance-local convenience (the FastAPI 301 is gone); preserving legacy *apex* `/sign-up` bookmarks needs instance selection and is deferred to #810. `DEPLOYMENT.md` drops the legacy single-instance flow
  - **The cutover is a coordinated deploy, not just a merge.** Removing the FastAPI static handlers means the app is only reachable once the Apache vhosts are serving. The production deploy must run `setup-landing.sh`/`setup-instance.sh` on the box and deploy both bundles in lockstep with merging this PR — see `scripts/DEPLOYMENT.md`. `bash -n` clean on all touched scripts; live `apache2ctl -t`/`certbot` checks are deferred to Phase 6
- ⬜ **Phase 6 — Multi-instance validation.** Stand up a second subdomain on the same VPS; verify cookie isolation, server-wide login, manifest per-instance, fragment + aggregation round-trip.

### Phase 1 deployment notes

- `scripts/deploy.sh` already targets the new `static/app/` path. No special migration needed.
- After the first deploy, the old `/var/www/.../energetica/static/react/` directory on the VPS becomes orphaned (rsync's `--delete` only operates inside the new target). Clean up once with `ssh <host> 'sudo rm -rf /var/www/energetica/energetica/static/react'`.
- Service worker does not precache anything under the renamed path; client caches recover on next page load.
- External bookmarks to top-level `/sign-up` 404 after Phase 1. (Resolved differently in Phase 5: the FastAPI 301 was dropped; `apache-instance.conf` now redirects `/sign-up` on instance subdomains. Stale bookmarks to the *apex* `/sign-up` remain deferred to the instance-picker work, #810 — do not re-add a `templates.py` handler.)
- `dist-landing/` is built but not deployed by `deploy.sh` yet — landing files only ship in Phase 5.

### Phase 2 deployment notes

Unlike Phase 1, Phase 2 changes the **auth path** and the **pickle shape**. The migration script must run on the VPS *before* the new code starts. Order:

1. **Stop the instance service** — `sudo systemctl stop energetica-{instance}` — so the pickle is not mutated concurrently with the migration.
2. **Create the accounts dir + DB** if it does not exist yet: `sudo mkdir -p /var/lib/energetica && sudo chown energetica:energetica /var/lib/energetica`. The script creates `accounts.db` on first connect; permissions on the file must allow the service user to read and write. (`scripts/vps-setup.sh` is slated for replacement in Phase 4; for now adjust manually.)
3. **Run the migration** as the service user (or root, then `chown` the resulting file): `sudo -u energetica .venv/bin/python scripts/migrate-to-server-accounts.py --pickle /var/www/energetica-{instance}/instance/engine_data.pck`. The script is idempotent — re-running after a partial failure is safe. Use `--dry-run` first to verify the expected user count.
4. **Deploy the new code** (`scripts/deploy.sh`) — this is what installs the auth refactor.
5. **Start the service** — `sudo systemctl start energetica-{instance}`.

If steps 3 and 4 are reversed (new code lands first), every login attempt will raise `RuntimeError: Pickle User is missing account_id — run scripts/migrate-to-server-accounts.py before starting the new code.` from `User.__setstate__`. Recovery: stop service, run migration, restart service.

`accounts.db` is a single point of failure for every instance on the VPS — back it up alongside the pickle. SQLite WAL mode means concurrent readers don't block; writers serialise. With one instance per VPS today and writes only on signup/password-change, contention is irrelevant in practice.

---

## Problem

FastAPI currently serves all static files (React bundles, images, game data) by proxying through Apache to uvicorn. Apache should handle static content natively and only forward dynamic traffic (API, WebSocket) to Python. Beyond the performance overhead, the current setup has no path to multi-instance deployment and bundles the landing/marketing site into the same JS bundle as the game.

---

## Goals

- Apache serves static files directly from the filesystem
- Split the frontend into two independent bundles: **landing** (public marketing) and **app** (game)
- Support multiple game instances per server via subdomains
- Formalise server/instance terminology and tooling
- Server-wide accounts: one set of credentials works on every instance on a given server
- Per-instance visibility and access policy: some instances are publicly advertised, others are private (unlisted and/or allowlist-gated)
- No singleton backend on the apex domain — the landing remains pure-static

---

## Rationale: Subdomains vs Subpaths

Game instances could have been deployed at subpaths (`energetica-game.org/autumn-2025/`) rather than subdomains (`autumn-2025.energetica-game.org`). Subdomains are the right choice for three reasons:

**Password managers** save credentials per origin (scheme + hostname). With subdomains, `autumn-2025.energetica-game.org` and `spring-2026.energetica-game.org` are separate origins — separate credential entries, correct autofill. With subpaths, both instances share `energetica-game.org` → password manager can't distinguish them → wrong autofill or credential collision.

**localStorage** is also isolated per origin. Subdomains give free, automatic per-instance isolation. With subpaths, all instances share the same `energetica-game.org` localStorage namespace — every key would need an instance-slug prefix throughout the codebase to avoid collisions.

**Session cookies** are the most critical. The session cookie is set with `path="/"` and no explicit domain, so it scopes to the current hostname. With subdomains, instance A's session cookie physically cannot be sent to instance B. With subpaths, all instances share `energetica-game.org` cookies — logging into one instance leaks the session cookie to all others, a real security problem. Fixing it would require FastAPI to set `path=/autumn-2025/` per instance, which the auth system has no concept of.

Subdomains also require less build configuration: subpaths need a per-instance Vite `base`, TanStack Router `basepath`, and FastAPI `root_path` — all three layers needing to agree per instance. Subdomains need only a new Apache vhost; one build works for all instances.

> **On shared credentials.** Server-wide accounts (introduced in [Server-Wide Accounts](#server-wide-accounts)) do **not** undo the cookie-isolation argument above. Credentials are shared via a server-side SQLite file; sessions are still per-subdomain. A user re-enters their password on each instance they visit and gets an independent session cookie for that origin. The cookie-leak class of bug remains structurally impossible.

---

## Terminology

| Term | Definition |
|------|------------|
| **Server** | A VPS, identified by its SSH alias (e.g. `energetica-game`, `energetica-edu`, `energetica-ethz`) |
| **Instance** | A single running game deployment on a server, identified by a kebab-case slug (e.g. `autumn-2025`, `spring-2026`). Also used for private university or business deployments. Player-facing copy may call this a "run". |
| **Account** | A server-wide identity. One row in the server's `accounts.db` SQLite file, keyed by `account_id`. Holds credentials (`username`, `pwhash`, optional `email`). Independent of any instance. |
| **User** (pickle) | A per-instance record in the engine pickle (`energetica/database/user.py`), keyed by a local AutoIDDict id. Carries `account_id` as a foreign key to the server-wide account. Auto-provisioned on first successful login to an instance. |
| **Player** | The game-side state of a user who has completed the settle flow. Distinct from `User`: a `User` may exist without a `Player`. |

Subdomain pattern: `{instance}.{server-domain}` — e.g. `autumn-2025.energetica-game.org`.

The **apex domain always serves the landing page**, never an instance directly.

**Internal vs player-facing terminology.** `instance` is the canonical term used throughout the codebase, configs, scripts, paths, and systemd units. Player-facing UI text may use **"run"** or **"instance"** interchangeably (frontend copy is a separate translation concern).

**Note on path collisions.** Today the engine working directory is named `instance/` per Flask convention (`/var/www/energetica-{slug}/instance/engine_data.pck`). This is unrelated to the deployment-unit term `instance` and is left in place — the duplicate word in `energetica-{instance}/instance/engine_data.pck` is awkward but not ambiguous in context.

### Instance name constraints
- Lowercase kebab-case only (`[a-z0-9][a-z0-9-]*[a-z0-9]`)
- Reserved names: **`landing`** (used for the landing site directory)

### Username constraints
- Globally unique per server (enforced by `accounts.username UNIQUE` in SQLite)
- Per-server scope only; the same username on `energetica-game` and `energetica-edu` are unrelated accounts

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
├── /instances.json         → Apache serves /var/www/energetica-landing/instances.json  (manifest, Cache-Control: max-age=60)
├── /instances/{slug}.json  → Apache serves /var/www/energetica-landing/instances/{slug}.json  (per-instance public fragment)
└── /*                    → FallbackResource → index.html  (SPA routing for /landing-page, /about, /for-educators, /wiki/*, /changelog)
```

The landing vhost uses `DocumentRoot /var/www/energetica-landing/`. With `base: "/"`, Vite emits assets at `/assets/index-abc123.js`; Apache serves them directly from DocumentRoot. No Alias needed.

The `instances.json` manifest and `instances/` fragment directory are populated by the instance backends themselves (see [Instance Visibility & Access](#instance-visibility--access)); the apex domain hosts no application logic.

### What FastAPI keeps

- `/api/v1/*` — REST API
- `/socket.io` — WebSocket
- `/logout` — deletes session cookie, redirects to `/app/login`

Everything else (`StaticFiles` mount, all `FileResponse` page handlers) is removed from FastAPI. (Phase 5; in Phase 1 the `FileResponse` handlers for `/`, `/app/*`, `/landing-page` still exist and serve the app bundle's `index.html` for interim compatibility.)

`energetica/static/apple-app-site-association` is also removed — it is legacy and no longer used. ✅ (Phase 1)

`/admin-dashboard` FastAPI handler is also removed; the dashboard was stub-only and will be rebuilt from scratch as a frontend-gated route when needed. ✅ (Phase 1)

### What FastAPI gains

- Reads `/var/lib/energetica/accounts.db` (shared SQLite) on signup, login, and password change.
- Reads its own `/etc/energetica/{instance}/instance.json` on every login attempt for access-policy enforcement (no in-memory cache — admin edits take effect on the next login). The file lives **outside the vhost DocumentRoot** so Apache cannot serve it as static — see [Instance Visibility & Access](#instance-visibility--access) for rationale.
- Writes its own sanitised fragment to `/var/www/energetica-landing/instances/{slug}.json` on process start and whenever `instance.json` is reloaded (see [Instance Visibility & Access](#instance-visibility--access)). Writes are atomic (write-to-tmp + rename).

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

SQLite is opened by every instance backend with WAL mode (concurrent readers, serialised writers). Writes are infrequent (signup, password change) and short.

### Flows

**Signup.** Only available on instance subdomains, never on the apex. The landing's signup CTA links to the latest advertised instance's `/app/sign-up`. Selection rule: `instances.json` is already sorted by `starts_at` descending (see [Publication to the landing](#publication-to-the-landing)), so the CTA target is the first entry with `advertised: true`. Revisited when a richer picker UI lands — see [Deferred / Out of Scope](#deferred--out-of-scope). Signup writes one row to SQLite `accounts` and one row to that instance's pickle `User`, in a single logical transaction (SQLite first; on failure of the pickle write, the SQLite row is rolled back).

**Login on the original signup instance.** Backend looks up `accounts` by `username`, verifies `pwhash`. On success, finds the matching pickle `User` by `account_id` and sets the session cookie.

**Login on a different instance (first time).** Same SQLite check. Then the instance's access policy is consulted (see below). If allowed, the backend auto-provisions a pickle `User(account_id, role="player", player=None)` in its own engine and proceeds. No `Player` is created — that still happens at the settle page, which serves as the real "join this instance" confirmation.

**Logout.** Unchanged; clears the session cookie for the current subdomain only.

**Password change.** Writes the new `pwhash` to SQLite. Other instances see the change on their next login attempt automatically (they read SQLite, not their pickle, for credentials). **Known limitation:** existing session cookies on other instance subdomains remain valid until they expire or the user explicitly logs out — `itsdangerous`-signed session tokens carry no reference to the current `pwhash`. If a password is changed as a security response (suspected compromise), the user must log out of each instance manually. Cross-instance session invalidation is listed under [Deferred / Out of Scope](#deferred--out-of-scope).

### Why credentials shared but sessions not

Per-subdomain cookie isolation is preserved as a security property (see [Rationale: Subdomains vs Subpaths](#rationale-subdomains-vs-subpaths)). Sharing the *credentials store* is what users actually want ("one account on the site"); sharing *sessions* across subdomains would require a parent-domain cookie and reintroduce the cross-instance cookie-leak class of bug. The cost of the chosen design is a second password prompt when a user first visits a new instance — accepted as worth the security simplification.

---

## Instance Visibility & Access

Two independent axes per instance:

- **Advertised vs unadvertised.** Whether the landing's instance picker lists it.
- **Public vs private.** Whether any server-wide account may log in, or only those on an allowlist.

Both axes are declared per-instance in a single file the instance backend owns:

```
/etc/energetica/{slug}/instance.json

  Public + advertised:
    { "name": "Autumn 2025",
      "advertised": true,
      "starts_at": "2025-09-15T00:00:00Z",
      "access": { "policy": "public" } }

  Private (allowlist-gated) + unadvertised:
    { "name": "ETHZ Spring 2026",
      "advertised": false,
      "starts_at": "2026-03-01T00:00:00Z",
      "access": { "policy": "private", "allowed_usernames": ["alice", "bob"] } }
```

`slug` is **not** stored in the file — it is the directory name under `/etc/energetica/`, mirroring the canonical slug from [Instance discovery](#instance-discovery). Subdomain is **not** stored either — the landing composes `${slug}.${apex}` at render time, where `apex` is a Vite build-time constant.

`starts_at` is the instance's real start time (ISO-8601 UTC), exposed to players as "running since X" and used by the landing to sort the instance list.

The file is re-read on every login attempt. There is no in-memory cache. Admin edits take effect on the next login with no restart and no SIGHUP.

### Why outside the vhost DocumentRoot

`instance.json` carries `allowed_usernames` for private instances. The vhost DocumentRoot is `/var/www/energetica-{slug}/`, and Apache has no catch-all deny rule for unlisted files — placing `instance.json` there would let a plain `GET https://{slug}.{apex}/instance.json` return the allowlist to anyone who guesses the URL. Moving the file to `/etc/energetica/{slug}/instance.json` makes that class of exposure structurally impossible: the file is not under any DocumentRoot, so no vhost configuration error can leak it.

### Publication to the landing

Each instance process, on start and whenever it reloads `instance.json`, writes a **sanitised fragment** to the landing dir:

```
/var/www/energetica-landing/instances/{slug}.json

  { "slug": "autumn-2025",
    "name": "Autumn 2025",
    "advertised": true,
    "starts_at": "2025-09-15T00:00:00Z" }
```

The `access` block (including `allowed_usernames`) is **stripped before write** — the landing dir is served statically by Apache, and any allowlist that reached it would leak to the internet. `starts_at` is preserved (it is public information).

Writes are atomic: write to `{slug}.json.tmp` then `rename(2)` over the target. No locking required across instance processes since each writes to a unique filename.

After writing its fragment, the instance process runs the aggregation step, sorting by `starts_at` descending so the most recent instance appears first. **Only advertised fragments are emitted into `instances.json`** — the slug is a subdomain and the manifest is world-readable, so listing an unadvertised slug would make an otherwise-hidden instance enumerable (see the Phase 3 implementation note). The conceptual `jq` form below shows the sort/shape; the implementation filters `advertised` first and runs in pure Python:

```bash
jq -s 'sort_by(.starts_at) | reverse | {instances: .}' \
  /var/www/energetica-landing/instances/*.json \
  > /var/www/energetica-landing/instances.json.tmp \
  && mv /var/www/energetica-landing/instances.json.tmp \
        /var/www/energetica-landing/instances.json
```

Two concurrent aggregations may interleave; last-writer-wins is harmless because every aggregator reads the same fragment dir and produces a complete snapshot. The atomic rename guarantees readers never see a partial file.

### Frontend consumption

The landing fetches `/instances.json` and renders advertised entries. Apache serves it with `Cache-Control: max-age=60` so admin changes propagate within a minute without explicit cache-busting.

Unadvertised instances that are public are reachable by direct URL — a user who knows the subdomain may sign up and play. Unadvertised + private instances are reachable only by URL *and* require allowlisted credentials.

### Operational notes

- The landing's `instances/` subdirectory must be writable by every instance's systemd unit. Cleanest: create a shared group `energetica`, `chmod g+ws /var/www/energetica-landing/instances/`, and run each `energetica-{slug}.service` as a user in that group. Setgid ensures new fragment files inherit group ownership.
- `/etc/energetica/{slug}/` is admin-owned (root:energetica, mode `0750`) so the instance unit can read but not modify its own policy. Admins edit `instance.json` via `sudo`.
- A instance going down does not currently remove its fragment. If permanent removal is desired, `teardown-instance.sh` deletes the fragment and re-runs the aggregation. Stale fragments for stopped-but-not-removed instances are tolerated — the landing UI can surface `status` later (deferred per [7a](#deferred--out-of-scope)).
- No cross-instance reads. Each instance reads only its own `instance.json` under `/etc/energetica/{own-slug}/`. The aggregation step reads only files inside the landing-owned `instances/` dir.

---

## Frontend Split Build

**Phase 1 status:** landed. Both bundles build, typecheck, lint independently. Landing routes are currently duplicated in `routes/` (still served by FastAPI) and `routes-landing/` (built into `dist-landing/`, not yet deployed). Phase 5 removes the duplicates and switches the landing to Apache.

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

✅ Both configs land in Phase 1. The landing bundle uses a separate `tsconfig.landing.json` (eslint sees both via `parserOptions.project: [...]`). Because shared components (`landing-page.tsx`, `wiki-sidebar.tsx`, etc.) link into `/app/*` routes that don't exist in the landing route tree, `main-landing.tsx` deliberately does **not** declare a `Register` module augmentation — typed `to` props fall back to `string`. This is acceptable during the interim; when Apache moves the landing to the apex domain, those links become explicit cross-origin `<a href>` and the loose typing is no longer load-bearing.

Both build outputs are **gitignored** and deployed via rsync:

| Bundle | Output dir | Gitignored | Deployed to |
|--------|-----------|------------|-------------|
| app | `energetica/static/app/` | yes | `server:/var/www/energetica-{instance}/energetica/static/app/` |
| landing | `frontend/dist-landing/` | yes | `server:/var/www/energetica-landing/` |

`.gitignore` must be updated: replace `energetica/static/react/*` with `energetica/static/app/*` and add `frontend/dist-landing/`. ✅ (Phase 1)

### `package.json` scripts

```json
"dev":            "vite",
"dev:landing":    "vite --config vite.config.landing.ts",
"build":          "vite build && bun run build:sw",
"build:landing":  "vite build --config vite.config.landing.ts && mv ../frontend/dist-landing/index.landing.html ../frontend/dist-landing/index.html",
"build:all":      "bun run build && bun run build:landing"
```

✅ Scripts added in Phase 1. The `mv` step renames the landing entry from `index.landing.html` (Vite preserves the source basename) to `index.html` so Apache's `FallbackResource → index.html` works without further configuration.

---

## Infrastructure Scripts

### New structure

```
scripts/
  infra/
    setup-base.sh             ← run once per server; installs Apache, Python, certbot, firewall, modules, jq;
                                creates /var/lib/energetica/ and accounts.db; creates /etc/energetica/;
                                creates `energetica` group
    setup-landing.sh          ← run once per server; creates /var/www/energetica-landing/, main domain vhost;
                                creates /var/www/energetica-landing/instances/ with setgid `energetica`
    setup-instance.sh           ← run per instance; usage: setup-instance.sh <instance> <port>;
                                creates /etc/energetica/{instance}/ and writes initial instance.json there
    apache-main.conf          ← main domain vhost template (static landing, no proxy)
    apache-instance.conf        ← instance vhost template (app static + API proxy)
    energetica.service        ← systemd service template (runs as user in `energetica` group)
    instance.json.tmpl          ← initial per-instance config; default policy is public, advertised true
  deploy-landing.sh           ← build:landing → rsync dist-landing/ → server:/var/www/energetica-landing/
  deploy-instance.sh            ← usage: --server <server> --instance <instance>;
                                does not touch /etc/energetica/{instance}/instance.json (admin-owned);
                                restart triggers fragment + aggregation rewrite
  list-instances.sh             ← usage: --server <server>; queries systemd, prints name/port/status table
  migrate-to-server-accounts.py  ← one-time per VPS; backfills accounts.db from the existing instance's pickle
                                   and writes account_id into each pickle User row
```

`scripts/vps-setup.sh` is superseded by the three `infra/setup-*.sh` scripts and will be removed.

### `setup-instance.sh` flow

1. Create `/var/www/energetica-{instance}/` directory structure
2. Clone repo (or symlink shared code — TBD)
3. Create `/etc/energetica/{instance}/` (mode `0750`, owned by `root:energetica`) and render `instance.json.tmpl` into `/etc/energetica/{instance}/instance.json` (defaults: `name = {slug titlecased}`, `advertised = true`, `starts_at = now (UTC)`, `access.policy = "public"` — admin edits before going live for private instances)
4. Create and enable Apache vhost from `apache-instance.conf` template
5. Reload Apache (HTTP only at this point)
6. Obtain TLS certificate: `certbot certonly --webroot -w /var/www/energetica-{instance}/ -d {instance}.{domain}` — the instance directory (created in step 1) is already the Apache DocumentRoot, so ACME challenge files are reachable there
7. Update vhost with SSL directives, reload Apache
8. Install certbot deploy hook to reload Apache on certificate renewal
9. Create and enable `energetica-{instance}.service` systemd unit (runs as a user in group `energetica` so it can write fragments to the landing's `instances/` dir)
10. `pip install -r requirements.txt`, start service — on startup the instance writes its sanitised fragment to `/var/www/energetica-landing/instances/{instance}.json` and runs the aggregation step

TLS provisioning (steps 6–8) requires the DNS record for `{instance}.{domain}` to already resolve to the server before running.

### `deploy-instance.sh` flow

1. Build app bundle (`bun run build`)
2. Confirm deployment summary (skipped with `--yes`)
3. `rsync` Python backend code to server (excluding `.venv`, `instance/`, build artifacts). `instance.json` lives outside the deploy dir (`/etc/energetica/{instance}/`) and is admin-owned, so it is never touched by deploys.
4. `rsync` app bundle to server (`energetica/static/app/`)
5. `rsync` service worker to server (`energetica/static/service-worker.js` — built separately by `build:sw`, lives outside the app bundle directory)
6. `pip install -r requirements.txt` on server if dependencies changed
7. `systemctl restart energetica-{instance}` — on restart the instance re-publishes its fragment and re-runs aggregation, picking up any admin edits to `instance.json` made since the last start
8. Health check

Scripts accept all inputs via arguments or env vars and support `--yes` to suppress confirmation prompts, making them callable from a CI job without modification. No commitment to a CI platform is made here.

### `deploy-landing.sh` flow

1. Build landing bundle (`bun run build:landing`)
2. `rsync dist-landing/` to `server:/var/www/energetica-landing/`

No service restart — landing is pure static. `instances.json` and `instances/` are not touched — they are owned by the instance backends and must not be overwritten.

### `migrate-to-server-accounts.py` flow

Run once per VPS, before the first deploy that ships server-wide accounts. Safely re-runnable: a partial failure (e.g. crash after some SQLite inserts but before the pickle is saved) is recovered by re-running the script.

1. Stop the instance service (`systemctl stop energetica-{instance}`) to prevent concurrent pickle mutation
2. Load the existing engine pickle (`/var/www/energetica-{instance}/instance/engine_data.pck`)
3. For each `User` in the engine's user table whose `account_id` is unset:
   - `INSERT OR IGNORE INTO accounts (username, pwhash, email, created_at) VALUES (?, ?, NULL, ?)` — `OR IGNORE` so an already-inserted row from a previous partial run is not treated as an error
   - `SELECT account_id FROM accounts WHERE username = ?` — retrieves the `account_id` whether the row was just inserted or already existed
   - Write `account_id` back into the pickle `User`
4. Save the modified pickle
5. Restart the instance service

The combination of (in-memory) per-user `account_id` guard and (on-disk) `INSERT OR IGNORE` + `SELECT` covers both failure modes: an interrupted run that didn't save the pickle, and an interrupted run that did. In both cases, re-running reaches the same end state.

Today there is exactly one instance per VPS, so no cross-instance username collisions are possible during migration. If multiple instances ever exist before this migration runs (e.g. on a new server that bootstrapped multi-instance before accounts were unified), the script must be re-thought.

---

## Deferred / Out of Scope

- **CI/CD** — deployment is via local scripts for now. Scripts are CI-compatible by design (all inputs via args/env vars, `--yes` flag, deterministic exit codes). Wiring to GitHub Actions or equivalent is a future decision.
- **Admin dashboard** — currently stubbed. The server-side role gate in `templates.py` will be dropped along with all other `FileResponse` handlers. A proper frontend route guard and admin UI are a separate workstream.
- **Landing images on multi-server** — landing pages reference images at `/static/images/`. On a server with no game instance (pure landing server), these paths would break. To be addressed when a second server deployment is made.
- **Service worker on multiple instances** — currently scoped to `/`. Per-instance scoping implications (e.g. `autumn-2025.energetica-game.org/service-worker.js`) are not an architectural concern but should be tested when the first subdomain instance goes live.
- **`instances.json` schema expansion** — current schema is `{slug, name, advertised, starts_at}`. Fields like `description`, `status`, `ends_at`, `thumbnail` will be added when an instance-picker UI needs them (YAGNI until then).
- **Instance-picker UI** — landing currently sends the signup CTA to the most recent advertised instance (`instances.json` is sorted by `starts_at` desc; first `advertised: true` entry wins). Lateral navigation between active instances (a picker page or persistent header element — UI form factor TBD) is a frontend workstream that consumes the existing `instances.json` data and may motivate schema additions above.
- **Password reset via email** — `accounts.email` is in the SQLite schema (nullable, unique) but not yet collected at signup. Adding the signup field and the reset-by-email flow (which requires an SMTP/transactional-mail dependency the project does not yet have) is a follow-up.
- **Cross-instance session invalidation on password change** — changing the password updates `pwhash` in SQLite but does not invalidate session cookies already issued by other instance subdomains (see [Password change](#flows) flow). Fixing this would require either a `session_version` column on `accounts` (bumped on password change, checked on every request) or a short server-issued session-validity window combined with a periodic re-check against SQLite. Deferred until there is a concrete security-response use case driving the cost.
- **`teardown-instance.sh`** — removing an instance cleanly (delete vhost, disable service, delete fragment, re-aggregate, optionally archive pickle) is not yet scripted. Stale fragments for stopped instances are tolerated until then.
- **Cross-server accounts** — accounts are scoped to a single VPS. The same username on `energetica-game` and `energetica-edu` are unrelated. Unifying identity across servers would require either a remote auth service or replication and is explicitly out of scope.
