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
| Run a **Workshop Run** locally               | see [below](#running-a-workshop-run-locally)     | local lobby + app       |

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

## Running a Workshop Run locally

An instance backend runs one of two kinds of Run: the persistent world, or a Workshop Run (a
moderated classroom session, see [Workshop Mode in CONTEXT.md](../../CONTEXT.md#workshop-mode)). It
reads which one from its `instance.json`. With no `instance.json`, as in the full local stack above,
it runs the persistent world. To run Workshop Mode, give the local app backend an `instance.json`
that says so.

### 1. Describe the Run (once)

The folder name is the Run's **slug**, its short identifier. Keep the file in the dev scratch:

```bash
mkdir -p .energetica-dev/etc/workshop-demo
cat > .energetica-dev/etc/workshop-demo/instance.json <<'EOF'
{"name": "Workshop demo", "advertised": false, "starts_at": "2026-03-01T00:00:00Z", "run": {"mode": "workshop"}}
EOF
```

### 2. Give two accounts access (once)

A Workshop Run is always private, so only accounts on its roster can enter. You need two accounts:
a **facilitator**, who runs the session, and at least one **player**. One account cannot be both in
the same Run.

Start the lobby first (`bun run serve:lobby`, or `bun run dev`), so the seeded `demo` account exists.
Create a second account by signing up on the lobby at http://localhost:5174 (sign-ups are on in local
development), or from the shell:

```bash
ENERGETICA_ACCOUNTS_DB_PATH=.energetica-dev/accounts.db .venv/bin/python -c '
from energetica.identity import accounts
from energetica.kernel.session import generate_password_hash
accounts.get_or_create_account_id(username="alice", pwhash=generate_password_hash("alice1234"))'
```

Setting `ENERGETICA_ACCOUNTS_DB_PATH` matters: without it, the account goes into
`instance/accounts.db`, which the lobby does not read.

Then make `demo` the facilitator and put `alice` on the roster. Both scripts default to the
production accounts path, so point them at the dev one:

```bash
.venv/bin/python scripts/lobby/grant-facilitator.py --username demo --slug workshop-demo --accounts-db .energetica-dev/accounts.db
.venv/bin/python scripts/lobby/whitelist-run.py workshop-demo add alice --accounts-db .energetica-dev/accounts.db
```

Once the Run is up, the facilitator can also add players from the roster page or with a join link.

### 3. Start the stack with the Run's slug

Two environment variables tell the app backend which `instance.json` to read. Set them for any of
the full-stack commands above:

```bash
export ENERGETICA_INSTANCE_CONFIG_DIR="$PWD/.energetica-dev/etc"
export ENERGETICA_INSTANCE_SLUG=workshop-demo
bun run dev            # or bun run serve:app in its own terminal, next to the lobby and frontends
```

Check that the backend is in Workshop Mode:

```bash
curl localhost:8000/api/v1/run     # {"mode":"workshop"}
```

Unset `ENERGETICA_INSTANCE_SLUG` to go back to the persistent world.

### 4. Play a session

Open http://localhost:5173 and log in. The session cookie is shared by every `localhost` port, so one
browser window holds one account. Use a private window, or a second browser, for the other one.

- As the **facilitator**, the top bar has the buttons that advance the session and extend the running
  phase.
- As a **player**, you buy facilities in the Investment phase and set prices in each Trading period.

The round-configuration levers (such as the Round format) have no page yet (#1018). Change them through
the API with a facilitator session:

```bash
bash scripts/dev-login.sh demo demo1234     # saves the session to .energetica-dev/cookies.txt
curl -b .energetica-dev/cookies.txt localhost:8000/api/v1/workshop/levers
curl -b .energetica-dev/cookies.txt -X PUT localhost:8000/api/v1/workshop/levers \
    -H 'Content-Type: application/json' \
    -d '{"round_format": {"trading_format": "full_season", "storage": "all"}}'
```

A `PUT` replaces every lever, so a lever left out of the body goes back to its default.

### 5. Set up a session from the shell

To get a session to a given point without clicking through it, such as a Trading period where players
own fuel-burning plants, drive the API with one cookie jar per account. This needs the lobby on :8001
and the app backend on :8000, started as in step 3. Run the app backend in its own terminal
(`bun run serve:app`), since step 5c stops and restarts it.

**a. Create the accounts and give them access** (step 2, for a facilitator and two players):

```bash
export ENERGETICA_ACCOUNTS_DB_PATH=.energetica-dev/accounts.db
.venv/bin/python -c '
from energetica.identity import accounts
from energetica.kernel.session import generate_password_hash
for name in ("prof", "alice", "bob"):
    accounts.get_or_create_account_id(username=name, pwhash=generate_password_hash(name + "1234"))'
.venv/bin/python scripts/lobby/grant-facilitator.py --username prof --slug workshop-demo --accounts-db "$ENERGETICA_ACCOUNTS_DB_PATH"
.venv/bin/python scripts/lobby/whitelist-run.py workshop-demo add alice bob --accounts-db "$ENERGETICA_ACCOUNTS_DB_PATH"
```

**b. Log each account in and enter the Run.** A player only exists in the session once they have entered:

```bash
for user in prof alice bob; do
    COOKIE_JAR=.energetica-dev/$user.txt bash scripts/dev-login.sh "$user" "${user}1234"
    curl -s -b .energetica-dev/$user.txt -X POST localhost:8000/api/v1/workshop/enter; echo
done
```

**c. Give the players enough money.** A player starts with 25,000 (a placeholder until the
game-balance pass), which buys no fuel-burning plant: the cheapest, the gas burner, costs 90,000.
There is no API for money, so edit the saved session. **Stop the app backend first**: a running
backend saves over the file on its next change and undoes the edit.

```bash
# Stop the app backend (Ctrl-C in its terminal), then:
.venv/bin/python - <<'EOF'
import json
from pathlib import Path
path = Path("instance/workshop_session.json")
session = json.loads(path.read_text())
for player in session["players"]:
    player["money"] = 10_000_000.0
path.write_text(json.dumps(session, indent=2))
EOF
# Start it again, and wait until it answers:
until curl -sf localhost:8000/healthz >/dev/null; do sleep 0.5; done
```

**d. Start Round 1 and buy plants.** Only what `GET /api/v1/workshop/facilities` lists is for sale:
upgrade tiers such as the combined cycle appear only once unlocked, and a nuclear reactor takes a Round
to build. Buy enough capacity for the market, or the first Trading period ends in a blackout, which
ends the Round. Demand is about 50 MW per player, most of which must be served, so give each player
around 70 MW or more. Three coal burners (21 MW each) and a gas burner (11 MW) do:

```bash
curl -s -o /dev/null -b .energetica-dev/prof.txt -X POST localhost:8000/api/v1/workshop/session/advance   # opens the Investment phase
for user in alice bob; do
    for facility in coal_burner coal_burner coal_burner gas_burner; do
        curl -s -o /dev/null -w '%{http_code} ' -b .energetica-dev/$user.txt -X POST \
            localhost:8000/api/v1/workshop/selection -H 'Content-Type: application/json' \
            -d "{\"facility\": \"$facility\"}"
    done
done; echo                                                    # 200 for each purchase
```

**e. Move on to the first Trading period.** The first advance closes the Investment phase, which buys
the selections. The second opens spring's price-setting window.

Levers take effect at a boundary, so set them (step 4) before the advance that reaches it. The Round
format is fixed when the Investment phase opens, so set it before step d. Once fuel purchase (#1009) is
merged, the fuel procurement lever is fixed when each Trading period opens: to see the fuel fields in the
bids panel, set it to manual before the second advance here, with
`-d '{"fuel_procurement": "manual"}'`.

```bash
curl -s -o /dev/null -b .energetica-dev/prof.txt -X POST localhost:8000/api/v1/workshop/session/advance   # closes the Investment phase
sleep 2                                                                                                   # the purchase happens just after
curl -s -o /dev/null -b .energetica-dev/prof.txt -X POST localhost:8000/api/v1/workshop/session/advance   # spring's window opens
curl -s -b .energetica-dev/alice.txt localhost:8000/api/v1/workshop/fleet; echo                           # Alice's plants
```

Log in as `alice` / `alice1234` in the browser to see her bids panel with the window open.

**f. Settle a Trading period and go to the next one.** The first advance closes the window, and the
period is simulated in the background. The simulation starts up to a second later, so `"settlement":
null` in the session does not prove the period is settled: it may not have started yet. Instead, keep
advancing until the checkpoint changes. Until the period is settled, an advance either leaves the session
where it is or is refused with `WORKSHOP_SETTLEMENT_RUNNING`, so it cannot skip a season:

```bash
checkpoint() {  # the checkpoint in an answer, or "busy" for a refused advance
    .venv/bin/python -c 'import json, sys; print(json.load(sys.stdin).get("checkpoint", "busy"))'
}
advance() { curl -s -b .energetica-dev/prof.txt -X POST localhost:8000/api/v1/workshop/session/advance; }

period=$(curl -s -b .energetica-dev/prof.txt localhost:8000/api/v1/workshop/session | checkpoint)
advance >/dev/null                          # closes the window
for attempt in $(seq 240); do               # up to 2 minutes: a full season takes about one
    now=$(advance | checkpoint)
    if [ "$now" != "$period" ] && [ "$now" != busy ]; then break; fi
    sleep 0.5
done
echo "$now"                                 # the next season, or the Recap after a blackout
```

If it shows the Recap and the session lists the period under `blackouts`, the Round ended there: buy
more capacity next time.

### 6. Saved state and starting over

The session is saved to `instance/workshop_session.json` after every change, and each settled Trading
period's record goes in `instance/workshop_session_periods/`. Restarting the backend resumes the
session where it was. To start the session over, keeping accounts and the Run's `instance.json`:

```bash
bun run serve:app --rm_instance
```

`bun run rm-instance` (see below) also deletes `.energetica-dev/`, which holds the accounts and the
Run's `instance.json`, so you would repeat steps 1 and 2.

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
serve:app      serve:app:fast   serve:app:test
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
