# Local Development

How to run Energetica locally, day to day. For one-time setup (Python venv, `bun install`), see
[installation.md](./installation.md) first.

## The mental model

Two questions decide every command:

1. **Which surface?** There are three separate frontend bundles — **`app`** (the in-run game SPA),
   **`lobby`** (sign-up / login / run picker), and **`landing`** (the static marketing site) — and
   two backends — the **app** server (`main.py`, the game instance) and the **lobby** server
   (`main_lobby.py`, server-wide auth). The scripts name the surface explicitly (`dev:app`,
   `dev:lobby`, `serve:app`, `serve:lobby`), never a bare `dev`/`serve`.

2. **Where's the backend?** A frontend dev server can proxy to a **local** backend you're running,
   or to a **live deployment**. You only need to run a local backend when you're changing backend
   code — for pure frontend work, point at a real deployment and skip the local servers entirely.

**Which package.json?** TypeScript scripts (`dev:*`, `build:*`, `lint`, `typecheck`, …) live in
`frontend/package.json` — run them with `cd frontend && bun run …`. Python + ops + full-stack
launchers live in the root `package.json` — run them from the repo root. (The cross-cutting quality
gate — `typecheck`, `lint`, `format`, `generate-types` — is also exposed at the root for
convenience, since it spans both.)

## Scenarios

| I want to…                                   | Command                                          | Backend used            |
| -------------------------------------------- | ------------------------------------------------ | ----------------------- |
| Change **lobby** UI against real data        | `cd frontend && BACKEND=game bun run dev:lobby`  | live game lobby         |
| Change **app** (game) UI against real data (public/pre-login) | `cd frontend && BACKEND=game bun run dev:app` | live game instance |
| **Authenticated app** work against live data | `BACKEND=game bun run dev`                        | live lobby + instance   |
| Work on the **landing** site                 | `cd frontend && bun run dev:landing`             | none (static)           |
| Full **local app** dev (frontend + backend)  | `bun run dev`                                    | local lobby + app       |
| Just the **lobby**, locally                  | `bun run dev:lobby`                              | local lobby             |
| **Backend** iteration, driven from the CLI   | `bun run serve:lobby` + `bun run serve:app`      | local lobby + app       |

`BACKEND=game` selects the live game deployment; `edu` and `ethz` select the other two (each maps to
`frontend/.env.{deployment}`). Omit `BACKEND` for a local backend. To pin one specific instance or
URL, set `VITE_BACKEND_URL` instead — it overrides everything.

## Frontend work against a live backend (the common case)

No local backend — the dev server proxies to a deployment that already has real data:

```bash
cd frontend
BACKEND=game bun run dev:lobby   # lobby SPA  → http://localhost:5174
BACKEND=game bun run dev:app     # app SPA    → http://localhost:5173
```

The app config discovers the deployment's current instance subdomain from its public
`instances.json`; the lobby config proxies to `lobby.{apex}`.

**Auth differs by surface, because of where the session cookie lands.** The lobby dev server logs
in for real: its login POST is proxied, and the response's `Set-Cookie` is rewritten to drop
`Secure`/`Domain` (`rewriteSetCookieForLocalhost`), so the session cookie sticks to
`http://localhost:5174`. Work on lobby UI against live data with your real credentials.

The **app** dev server run *alone* against a live backend can't authenticate: its "log in" bounce
points at the local lobby dev server (:5174), and if nothing is running there the link dead-ends. So
`BACKEND=game bun run dev:app` on its own is for the **public / pre-login** surface. For authenticated
app work against live data, run both frontends as one stack (next).

## Authenticated app work against a live backend

```bash
BACKEND=game bun run dev    # app :5173 + lobby :5174, both proxying to the live game deployment
```

One launcher, both frontends, same `BACKEND` — no local backends. The flow:

1. Open **http://localhost:5173**, unauthenticated → click "log in" → bounce to the lobby dev server
   at **http://localhost:5174**.
2. The lobby dev server proxies your login to the **live** `lobby.{apex}` and logs you in with your
   real credentials. The live cookie comes back `Domain=.{apex}; Secure`, but the proxy strips both
   attributes (`rewriteSetCookieForLocalhost`), leaving a **host-only `localhost` cookie**.
3. Because cookies aren't isolated by port, that one cookie is sent to **:5173** too. Its `/api`
   proxies to the live instance, whose entry gate validates the token against the deployment's
   server-wide secret — so you're authenticated as your real account, against live data.

Why both frontends and one launcher: they must share `BACKEND`, or the lobby mints a cookie signed
by a *different* backend than the app talks to, and the live instance rejects it with a bare 401.
Running them separately invites that mismatch; the launcher forecloses it.

Two things to know:

- **You operate as your real account on live data** — the entry gate provisions you on the live
  instance and your writes hit it, exactly as logging into prod does. This is intended, not a
  sandbox.
- **One instance only.** The app dev server proxies to a single live instance (the newest
  advertised, or `VITE_BACKEND_URL` if pinned). The in-run switcher marks that instance and disables
  hops to your other runs — those are prod origins, not this local dev app. Pin `VITE_BACKEND_URL`
  to target a specific instance.

## Full local stack (backend work)

Since the [lobby cutover](../architecture/lobby.md), the app server **no longer mints sessions** —
it's a pure *entry gate* that validates the SSO cookie the **lobby** issues and auto-provisions a
local user on first visit. So a usable local app backend needs the **lobby running too**, and both
backends must share one signing secret + accounts store. `scripts/lib/dev-env.sh` wires that up under
`.energetica-dev/` (gitignored, outside `instance/`), and the launcher starts everything:

```bash
bun run dev          # lobby + app backends (shared scratch) + lobby + app frontends; Ctrl-C stops all
```

Then open **http://localhost:5173**, get bounced to the lobby (http://localhost:5174), log in as the
seeded **`demo` / `demo1234`**, and return to the app — the entry gate provisions your user.

Prefer separate terminals (independent logs, hot-reload per server)? Run the pieces yourself:

```bash
bun run serve:lobby                 # lobby backend  :8001  (seeds the demo account + sample runs)
bun run serve:app                   # app backend    :8000  (shares the lobby's secret + accounts)
cd frontend && bun run dev:lobby    # lobby frontend :5174
cd frontend && bun run dev:app      # app frontend   :5173
```

**Driving the backend from the CLI (no browser):** with the lobby running, mint a real session into
a cookie jar and use it directly — this hits the lobby's production login, so it's the same session a
browser gets:

```bash
bun run dev:login                                        # demo / demo1234 → .energetica-dev/cookies.txt
curl -b .energetica-dev/cookies.txt localhost:8000/api/v1/auth/me
```

## Command reference

**Frontend** (`cd frontend && bun run …`):

```bash
dev:app       dev:lobby       dev:landing        # dev servers (prefix BACKEND=game|edu|ethz for a live backend)
build:app     build:lobby     build:landing      build:all
typecheck     lint            format             generate-types
```

**Backend & ops** (repo root, `bun run …`):

```bash
dev            # launcher: full local app stack (one terminal)
dev:lobby      # launcher: local lobby stack
dev:login      # mint a lobby session for CLI use (lobby must be running)
serve:app      serve:app:fast   serve:app:test   serve:app:no-signup
serve:lobby
typecheck  typecheck:py  lint  format  generate-types  ruff:check  ruff:format
rm-instance    # full local reset (see below)
```

> Note: at the repo root, `bun run dev:lobby` is the **launcher** (backend + frontend). The
> frontend-only lobby dev server is `cd frontend && bun run dev:lobby`.

### Backend flags

`serve:app:*` forward to `main.py`; run `bash scripts/dev-app.sh --help`-style flags directly for
others:

```bash
bun run serve:app:fast        # fast clock (1s tick, 1h/tick) for quick game progression
bun run serve:app:test        # fresh instance + seeded test players/bots
bun run serve:app:no-signup   # fresh instance with signups disabled
```

## Ports

| Service          | URL                     |
| ---------------- | ----------------------- |
| app frontend     | http://localhost:5173   |
| lobby frontend   | http://localhost:5174   |
| landing frontend | http://localhost:5175   |
| app backend      | http://localhost:8000   |
| lobby backend    | http://localhost:8001   |

Fixed per surface (in `frontend/vite.shared.ts`) so all three frontends can run at once. The app
bundle's "log in" bounce targets the lobby port; override with `VITE_LOBBY_URL` if you change it.

## Local state & resetting

- **`instance/`** — the app server's game state (engine pickle, checkpoints). `--rm_instance`
  (`serve:app:test`) wipes this.
- **`.energetica-dev/`** — the shared identity scratch: signing secret, `accounts.db`, seeded runs.
  Deliberately outside `instance/` so resetting game state leaves your login intact — mirroring
  production, where accounts are server-wide and outlive any single run.

Full reset (stop the servers first):

```bash
bun run rm-instance    # clears instance/, checkpoints/, .energetica-dev/, and the dev instances.json
```

Restarting `serve:lobby` (or `bun run dev`) re-seeds the `demo` account and sample runs.

## Next steps

- [Architecture Overview](../architecture/overview.md)
- [Lobby & SSO](../architecture/lobby.md) — why a local app backend needs the lobby
- [Frontend Documentation](../frontend/overview.md)
