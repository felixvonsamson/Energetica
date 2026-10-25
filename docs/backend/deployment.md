# Deployment Guide

Energetica deploys as one **landing** site on the apex domain plus one or more
**instances**, each on its own subdomain. Apache serves all static content
(landing, app bundle, service worker, PWA manifest) directly from disk;
uvicorn handles only `/api`, `/socket.io`, and `/logout`. See
`docs/architecture/static-serving-and-deployment.md` for the full design.

Server-side code delivery uses **rsync, not git** — there is no git checkout on
the server.

## Initial Setup (One-Time)

`scripts/infra/*` (the `setup-*.sh` scripts below) are never copied over to the
server by the normal deploy scripts. Instead, push them from your machine first:

```bash
./scripts/push-bootstrap.sh --server energetica-game
```

This flattens `scripts/infra/*` into `/tmp` on the server (deliberately not a persistent
path — these are meant to be re-synced immediately before use, not trusted to still be current
later). Then, on the VPS, as root:

```bash
sudo bash /tmp/setup-base.sh                                    # Apache, Python, certbot, firewall,
                                                                 # `energetica` group/user, shared dirs,
                                                                 # server.json, lobby service user,
                                                                 # signing secret, socket + unit
                                                                 # (the OS "deploy" user must already exist)
sudo bash /tmp/setup-landing.sh --domain energetica-game.org    # apex vhost + TLS
sudo bash /tmp/setup-lobby.sh --domain energetica-game.org      # lobby vhost+TLS+unit
sudo bash /tmp/setup-instance.sh autumn-2025 8004 --domain energetica-game.org --mode freeplay  # vhost+TLS+unit
```

`--mode` is required and has no default: it is the kind of Run (`freeplay` or `workshop`), and
the backend rejects an `instance.json` that does not state one. A `workshop` Run is provisioned
private. The backend reads the mode when it starts (`energetica/entry.py`): a `workshop` Run
serves Workshop's app, with no game engine or tick loop, and saves its session to
`instance/workshop_session.json`. Changing the mode takes effect on the next restart.

`setup-instance.sh` provisions the box (directory, venv, `/etc/energetica/{slug}/instance.json`
and `instance.env`, vhost+TLS, enabled-but-unstarted unit) but ships **no** code and does **not**
start the service. The first deploy is what ships the backend and starts it. `setup-lobby.sh`
works the same way for the lobby backend. `setup-base.sh` installs the lobby service's units
(`energetica-lobby-service.socket` and `.service`) and enables the socket; the service's code
ships with the lobby, so it first runs after the first `deploy-lobby.sh`.

Every service needs its own uvicorn port: the lobby defaults to **8002** (`--port`
overrides), so give each instance a different one. `setup-lobby.sh` refuses a port
already claimed by another `energetica-*` unit or by another instance's `instance.env`.

### Where an instance's configuration lives

Two files, both in `/etc/energetica/{slug}/`, both `0640` and readable by the `energetica` group:

- **`instance.json`** — the run's identity and access policy: name, whether it is advertised,
  the lifecycle dates, the join token, and which kind of Run it is (`"run": {"mode": ...}`).
  Read fresh on every login, and written back to by the service for private-access changes. An admin can edit it at any time; no restart needed.
  Owned by `energetica`, because the service is what rewrites it.
- **`instance.env`** — how the service runs: the environment contract
  (`ENERGETICA_INSTANCE_SLUG`, the path variables and the lobby service's socket,
  `ENERGETICA_LOBBY_SERVICE_SOCKET`) and the port and two clock values.
  The unit reads it with `EnvironmentFile=` and expands the last three into `main.py` flags, so
  the unit differs between instances only by name. Edits take effect on the next restart. There
  is no fallback if the file goes missing: the unit refuses to start rather than run an instance
  that believes it is public. Owned by `root`, and only root can replace it.

The port lives in `instance.env` for a second reason — it is the one place anything else can
read it from. The `deploy` user is in the `energetica` group, so discovering an instance's port
is a plain read with no `sudo`. That is how `list-instances.sh` reports it.

The directory is `1770 root:energetica`. Group-writable so the service can rename its temp file
over `instance.json`, and sticky so that permission does not also let the group replace
`instance.json`'s neighbours — under the sticky bit only a file's owner may replace it, which is
why the two files above are owned differently. Editing `instance.json` by hand with an editor
that saves by rename will reassign its ownership and stop the service writing it; if that
happens the error says which `chown` restores it.

Root cannot write into `instance.json` either: `printf … > instance.json` or `tee` run as root
fails with `Permission denied`. The cause is the kernel setting `fs.protected_regular = 2`
(Ubuntu's default). In a sticky directory that the group can write, it refuses to open an
existing file for writing when the file belongs to someone other than the directory's owner
and the writer, and that includes root. It exists so that another user cannot plant a file
that root then writes into. Write the file as its owner instead, which also keeps its owner and
mode:

```bash
printf '%s\n' "$NEW" | runuser -u energetica -- tee /etc/energetica/{slug}/instance.json >/dev/null
```

Instances provisioned before this split carry their configuration inside the rendered unit. The
one-off migration is in the commit that introduced the split — `git log --grep '#1072'` — rather
than a script in the tree, since it is worth running exactly once per instance and nothing would
keep it honest afterwards.

The `energetica` service user's home is `/var/cache/energetica`, which holds pip's download
cache. Servers provisioned before #1067 have the home on the root-owned `/var/www`, where pip cannot
write, so every dependency install re-downloads from PyPI. Re-running `setup-base.sh` creates the new
directory and tries to move the home, but `usermod` refuses while any `energetica-*` service is
running, so on a live server it reports that and carries on. Finish with a short outage rather
than re-running the whole script with the games down: stop every service that
`systemctl list-units --type=service 'energetica-*'` lists, run `sudo usermod --home
/var/cache/energetica energetica`, and start them again. Leave `energetica-reaper` and its timer
alone: the reaper runs as root, so it does not block the change. The services also get the new `HOME` once restarted, since
systemd takes it from the account; nothing in the game reads it.

DNS for the apex and each `{instance}.{domain}` subdomain must resolve to the server before
running the setup scripts (certbot uses the webroot challenge). For a private/unadvertised
instance, `sudo`-edit `/etc/energetica/{instance}/instance.json` before the first login.

Certificates auto-renew via certbot's own timer + the deploy hook `setup-base.sh` installs
(reloads Apache on renewal). To check an individual certificate's expiry directly:

```bash
ssh energetica-game 'sudo openssl x509 -enddate -noout -in /etc/letsencrypt/live/autumn-2025.energetica-game.org/cert.pem'
```

## Regular Deployments

From your local machine:

```bash
./scripts/deploy-instance.sh --server energetica-game --instance autumn-2025 --domain energetica-game.org
./scripts/deploy-landing.sh  --server energetica-game --domain energetica-game.org
./scripts/deploy-lobby.sh    --server energetica-game --domain energetica-game.org
./scripts/list-instances.sh  --server energetica-game
```

- `deploy-instance.sh` builds the app bundle locally (baking `VITE_APEX_DOMAIN` so
  cross-origin links resolve) and the backend wheel, rsyncs the Python backend + bundle,
  installs the wheel into the server venv, restarts the service, and polls `/healthz`. On
  restart the instance re-reads `instance.json` and re-publishes its landing fragment, so
  admin policy edits take effect. Before any of that, it checks the instance's `instance.json`
  against the backend it is about to ship, and refuses to deploy if the new code would reject it.
  Downtime is ~10-30 seconds while the restart happens — Apache and every other instance keep
  serving throughout. Game state isn't touched: it lives in the instance's own `instance/`
  directory, which the rsync step excludes.
- `deploy-landing.sh` builds the landing bundle (also baking `VITE_APEX_DOMAIN` so the
  "Play now" / "Log In" CTAs target `lobby.{apex}`) and rsyncs `frontend/apps/landing/dist/`. It preserves
  the instance-owned `instances.json` and `instances/` dir. No service restart — the landing
  is pure static.

- `deploy-lobby.sh` builds the lobby bundle (no apex baking — the lobby derives it from
  its own hostname at runtime), rsyncs the backend + `dist-lobby/` to
  `/var/www/energetica-lobby`, and installs the backend wheel into the server venv. It then
  restarts the lobby service (`energetica-lobby-service`), which runs any pending schema
  migrations on `lobby.db` before serving, and checks its `healthz` over the socket.
  Last, it restarts the lobby backend (`energetica-lobby`) and health-checks the vhost.
  It refuses to deploy to a box whose `setup-base.sh` predates the lobby service's units or its
  own Unix user, or whose `setup-lobby.sh` rendered the lobby backend's unit before it knew the
  service's socket. Re-run whichever it names; both are idempotent. For a box set up before
  #1284, see [Moving the lobby database to its own user](#moving-the-lobby-database-to-its-own-user-1284)
  first.
  Callers do not fail while the lobby service restarts: systemd holds its socket open, so
  their requests wait.

Each deploy script also syncs a target-specific `scripts/` subset, flattened with no
subfolder on the server: `deploy-instance.sh` ships `scripts/instance/` (currently
`drop_player_pwhash.py`, `export_instance_to_csv.py`, `shift_start_date.py`), `deploy-lobby.sh` ships `scripts/lobby/` (currently
`grant-facilitator.py`, `whitelist-run.py` — both are clients of the lobby service, so they
live with the lobby, not with any single instance). `scripts/dev/`, `scripts/lib/`, and
`scripts/*.ts` never touch the server.

`instance.json` and `instance.env` live outside the deploy dir (`/etc/energetica/{instance}/`)
and are admin-owned, so deploys never touch them. The server-wide `/etc/energetica/server.json`
(the lobby's signup toggle) is likewise admin-owned; `sudo`-edit it and the lobby picks
the change up on the next request — no restart.

### Options

`deploy-instance.sh`: `--yes` (skip confirm), `--skip-build`.
`deploy-landing.sh`: `--yes`, `--skip-build`.
`deploy-lobby.sh`: `--yes`, `--skip-build`.

`--skip-build` skips only the frontend bundle. There is no way to skip installing the backend:
the backend lives under `src/` and is imported as an installed package, so a deploy that did
not install it would leave the service unable to start.

The SSH user is always `deploy`. `--server`/`--domain` also accept env vars (`DEPLOY_HOST`,
`DEPLOY_DOMAIN`), so the scripts run unattended from CI.

## Adding the Run mode to existing instances (#1060)

Do this once per instance, before the first deploy that includes #1060.

From #1060 on, every `instance.json` must say which kind of Run it is, in a `run` block. There is
no default, on purpose: the file is written to say what the Run is, not to guess. The cost is that
neither backend accepts both shapes. The new one rejects a file with no `run` block, and the old
one rejects a file that has one, because the file forbids unknown keys. A rejected file does two
things to a running instance:

- **Every login is refused.** The login path fails closed on a file it cannot read, so the Run's
  players are locked out, public Run or not.
- **A frozen Run unfreezes.** The phase check fails open to `active` so that a typo never freezes
  a live game, which means a Run past its `freeze_at` starts simulating again.

So each instance goes through this order: stop it, edit the file, deploy, and let the deploy
start it.

**1. List the instances.** Work from the service units, not from the public `instances.json`,
which by design lists only advertised Runs:

```bash
./scripts/list-instances.sh --server energetica-game
```

At the time of #1060 there are four.

**2. Stop the instance and edit its file.** On the VPS, as root. The write goes through `tee`
run as `energetica`, because the kernel setting `fs.protected_regular` stops root from writing
into a file that another user owns in this directory. Writing into the existing file keeps its
owner (`energetica`) and mode (`0640`). Do not edit it with an editor that saves by rename (see
[Where an instance's configuration lives](#where-an-instances-configuration-lives)), which
covers both points.

```bash
SLUG=autumn-2025
CONFIG=/etc/energetica/$SLUG/instance.json

systemctl stop "energetica-$SLUG"
NEW="$(jq '. + {run: {mode: "freeplay"}}' "$CONFIG")" \
  && printf '%s\n' "$NEW" | runuser -u energetica -- tee "$CONFIG" >/dev/null
jq -e '.run.mode == "freeplay"' "$CONFIG"   # prints true
stat -c '%U:%G %a' "$CONFIG"                # energetica:energetica 640
```

Every instance live at the time of #1060 is a persistent-world Run, so the mode is `freeplay`.

**3. Deploy.** From your machine. The deploy's restart is what starts the stopped instance, so do
not `systemctl start` it by hand in between: that would run the old code against the new file.

```bash
./scripts/deploy-instance.sh --server energetica-game --instance "$SLUG" --domain energetica-game.org
```

Before it ships anything, the deploy reads the instance's `instance.json` and checks it with the
code it is about to install. If step 2 was missed or went wrong, it refuses, prints which field is
at fault, and leaves the server as it was. The instance is still stopped at that point: fix the
file and deploy again.

The reaper needs nothing. It reads `ended_at` with `jq` and no schema, so it works on either shape.

## Dropping `Player.pwhash` from saved runs (#1341)

Do this once per instance, after the first deploy that includes #1341.

Each `Player` used to keep a copy of its account's password hash, which nothing read. #1341 removes
the field from the code, but a run saved before that still carries the hash in its pickle. The new
code loads such a pickle without trouble and never reads the hash, so this step only removes it.
The old code cannot load a migrated pickle safely, so to roll back past #1341, restore the backup
the script writes.

**1. Deploy as usual.** The instance restarts on the new code with the hashes still in its state.

```bash
SLUG=autumn-2025
./scripts/deploy-instance.sh --server energetica-game --instance "$SLUG" --domain energetica-game.org
```

**2. Stop the instance and run the script.** On the VPS, as root. The script refuses to run while
it can see the instance running, because the next save would write the hashes back. Check with
`--dry-run` first: it prints how many players carry a hash.

```bash
SLUG=autumn-2025   # set again: this runs on the VPS
cd "/var/www/energetica-$SLUG"
systemctl stop "energetica-$SLUG"
sudo -u energetica .venv/bin/python scripts/drop_player_pwhash.py --pickle instance/engine_data.pck --dry-run
sudo -u energetica .venv/bin/python scripts/drop_player_pwhash.py --pickle instance/engine_data.pck
systemctl start "energetica-$SLUG"
```

Stopping loses nothing. As on any restart, the instance replays the action log from its last save.

**3. Remove the copies that still hold hashes**, once the instance is healthy again:

- the backup the script wrote, `instance/engine_data.pck.bak-<timestamp>`;
- any older pickle kept by hand in `instance/`, such as `engine_data.pck.pre-main`.

`checkpoints/last_checkpoint.tar.gz` still holds the hashes until the next checkpoint replaces it,
at most 6 hours later. The action logs hold none: at the time of #1341, no live instance's log has
a `create_user` line, the only kind that recorded a hash.

## Moving the lobby database to its own user (#1284)

Do this once per server, as a short maintenance step. It needs no change to any instance's
game state.

Until #1284 the lobby service ran as `energetica`, and the database
(`/var/lib/energetica/accounts.db`) and the signing secret sat where every process in the
`energetica` group could read them, because runs on old code opened the database and checked
cookies themselves. #1284 removes the last of that code. The lobby service now runs as its own
user, `energetica-lobby-service`, and keeps both in `/var/lib/energetica-lobby-service/` (0700),
the database renamed to `lobby.db`. Its first start on the new code also runs migration 2, which
drops the vestigial `instance_membership.settled_at` column.

**0. Check that no running instance is on code from before #1283.** Such code opens
`accounts.db` itself, and writes `settled_at` when a player settles. Every instance's backend
commit must include #1283 (merged as `2ae46483`):

```bash
git fetch origin main
./scripts/deployed-versions.sh --server energetica-game --domain energetica-game.org
```

Redeploy any instance that is older, after running `update-instance-unit.sh` for it (see
[below](#updating-an-existing-instances-unit-and-instanceenv)). `setup-base.sh` also refuses to
move the files while a running instance's `instance.env` lacks `ENERGETICA_LOBBY_SERVICE_SOCKET`,
which is a sure sign of old code, but it cannot see an instance whose `instance.env` was updated
and that was then never redeployed.

**1. Try the migration on a copy of the production database.** Take the copy with SQLite's
online backup, which is safe while the service is running. On the VPS, as root:

```bash
sudo sh -c 'umask 077 && python3 -c "import sqlite3; sqlite3.connect(\"file:/var/lib/energetica/accounts.db?mode=ro\", uri=True).backup(sqlite3.connect(\"/tmp/accounts-copy.db\"))"'
sudo chown deploy /tmp/accounts-copy.db
```

Then on your machine, from the checkout, with the copy in a new, empty directory:

```bash
mkdir /tmp/lobby-db-check
scp energetica-game:/tmp/accounts-copy.db /tmp/lobby-db-check/lobby.db && ssh energetica-game 'rm /tmp/accounts-copy.db'
.venv/bin/python -c 'from pathlib import Path; from lobby_service.schema import upgrade_database; upgrade_database(Path("/tmp/lobby-db-check/lobby.db"))'
sqlite3 /tmp/lobby-db-check/lobby.db 'PRAGMA user_version; PRAGMA table_info(instance_membership); SELECT count(*) FROM instance_membership;'
sqlite3 /tmp/lobby-db-check/lobby.db.pre-migration 'SELECT count(*) FROM instance_membership;'
```

The version should read 2, the table should have no `settled_at`, and the two row counts should
match. Delete `/tmp/lobby-db-check` afterwards: it holds every password hash.

**2. Re-run `setup-base.sh`.** On the VPS, as root, after `./scripts/push-bootstrap.sh`:

```bash
sudo bash /tmp/setup-base.sh
```

It creates the user and its directory, stops the lobby service and its socket, moves
`accounts.db` (with any `-wal`, `-shm` and `.pre-migration` files) to
`/var/lib/energetica-lobby-service/lobby.db` and the secret next to it, installs the new unit and
starts the socket again. A clean stop folds SQLite's `-wal` file back into the database. While
the socket is stopped, runs and the lobby answer requests that need an account with a 503, for a
few seconds. The service then starts on the code already deployed, which reads both paths from
the unit, so nothing else changes yet.

**3. Deploy the lobby.** The service restarts on the new code and runs migration 2, keeping a copy
of the database from just before at `lobby.db.pre-migration`:

```bash
./scripts/deploy-lobby.sh --server energetica-game --domain energetica-game.org
```

**4. Remove the retired variable from each instance.** `ENERGETICA_ACCOUNTS_DB_PATH` is no longer
read by anything, so this is tidying, and the instance picks it up at its next deploy:

```bash
sudo bash /tmp/update-instance-unit.sh autumn-2025
```

**Rolling back** past step 3 means restoring `lobby.db.pre-migration`: code from before #1284
refuses to start on a database at version 2. Anything written since step 3 (new accounts,
password changes, joins) is lost. Stop the service and its socket first, so nothing writes while
the file is replaced, and keep the file owned by the service's user. On the VPS, as root:

```bash
cd /var/lib/energetica-lobby-service
systemctl stop energetica-lobby-service.socket energetica-lobby-service.service
rm -f lobby.db-wal lobby.db-shm
cp -p lobby.db.pre-migration lobby.db
```

Leave the socket stopped: a request would start the service on the new code, which would migrate
the restored file again. Then deploy the older lobby with `deploy-lobby.sh`. Its restart of the
service starts the socket too. The older code reads both paths from the unit, so it runs from the
new location as it is.

## Changing an instance's Apache vhost

Deploys never write `/etc/apache2/sites-available/`. Writing an Apache config and reloading
Apache is equivalent to root — a config can `Include` arbitrary files, set `User`, and enable
CGI — and the `deploy` user is deliberately not granted it. So a change to
`scripts/infra/apache-instance.conf` reaches a running instance through one command per
instance, run as root on the server:

```bash
./scripts/push-bootstrap.sh --server energetica-game
```

Then, on the VPS as root — the same way the setup scripts above are run, and for the same
reason. It cannot be an `ssh energetica-game '…'` one-liner: that connects as `deploy`, whose
passwordless sudo covers only the per-instance `pip` and `systemctl`/`journalctl` on
`energetica-*`, so `sudo bash` would sit waiting for a password on a connection that has no
terminal to type it into.

```bash
sudo bash /tmp/update-instance-vhost.sh autumn-2025 --domain energetica-game.org
```

`update-instance-vhost.sh` is the only thing that renders the vhost template, and
`setup-instance.sh` calls it rather than repeating the substitution, so provisioning a new
instance and migrating an old one cannot drift apart. It takes no port: it reads
`ENERGETICA_PORT` from the instance's own `instance.env`, the same file the running service
gets its port from, so there is nothing to type that could disagree with what is listening.

It is safe to rerun. With the template unchanged it says so and does nothing. If the rendered
vhost fails `apache2ctl configtest` it puts the previous file back and does not reload — which
matters because Apache's configuration is server-wide: a vhost that fails the test would fail
every later reload on that box, including the certbot renewal hook's, and cost every instance
its TLS renewal.

### Updating an existing instance's unit and `instance.env`

`setup-instance.sh` renders the systemd unit and `instance.env` once, and deploys never touch
either, since both belong to root. A change to `scripts/infra/energetica.service` or
`scripts/infra/instance.env.tmpl` reaches a running instance through `update-instance-unit.sh`,
pushed and run the same way as the vhost script above:

```bash
sudo bash /tmp/update-instance-unit.sh autumn-2025
```

It re-renders the unit, adds to `instance.env` any variable the template gained whose value is
the same on every instance, removes any variable the code no longer reads (today
`ENERGETICA_ACCOUNTS_DB_PATH`), leaves every other line alone, and reloads systemd. It does not
restart the instance; the next deploy does. It is safe to rerun.

Runs reach accounts and sessions through the lobby service since #1283, so every instance set up
before then needs this once: its `instance.env` lacks `ENERGETICA_LOBBY_SERVICE_SOCKET` and its
unit does not want `energetica-lobby-service.socket`. `deploy-instance.sh` checks both and
refuses to deploy until the script has run, since the new code would otherwise answer every
request that needs an account with a 503. Deploy the lobby first (`deploy-lobby.sh`), so the
service is running before any run depends on it.

## SSH Configuration

Add to `~/.ssh/config`:

```
Host energetica-game
    HostName <your-vps-ip-or-domain>
    User deploy
```

Or override the host with the `DEPLOY_HOST` environment variable.

## Backup

Download an instance's game state (the `instance/` dir):

```bash
./scripts/download-instance.sh --server energetica-game --instance autumn-2025
```

`lobby.db` (`/var/lib/energetica-lobby-service/lobby.db`) holds the accounts and memberships of
every instance on the VPS — back it up alongside the per-instance state. Only root and the lobby
service's user can read it. Before each schema migration, the lobby service also keeps one copy
of it from just before, at `/var/lib/energetica-lobby-service/lobby.db.pre-migration`, replaced
at the next migration.

## Monitoring

View logs / restart / health-check a single instance:

```bash
ssh energetica-game 'sudo journalctl -u energetica-autumn-2025 -f'
ssh energetica-game 'sudo systemctl restart energetica-autumn-2025'
curl https://autumn-2025.energetica-game.org/healthz
```

The lobby service has no network port. Its log names the caller of each request
(`X-Energetica-Caller`), and its `healthz` reports the schema version and the API versions it
serves:

```bash
ssh energetica-game 'sudo journalctl -u energetica-lobby-service -f'
ssh energetica-game 'curl -s --unix-socket /run/energetica/lobby-service.sock http://lobby-service/internal/v1/healthz'
```

## Checking what is deployed

The server has no git checkout (deploys rsync with `--exclude='.git'`), so a component cannot
read its own commit from git. Instead each half is stamped, and both are reported by `/healthz`:

- **Backend** — `deploy-instance.sh` / `deploy-lobby.sh` write `DEPLOYED_VERSION.json` to the
  deploy root just before the restart, capturing the commit, branch, dirty flag, deployer, and
  timestamp. It goes in before the restart because a backend also names its commit in the
  `X-Energetica-Caller` header it sends the lobby service, and the backend reads the stamp only once.
- **Frontend** — the vite build writes `build-info.json` into the bundle it emits.

`/healthz` reads both and returns a `version` block:

```json
{
  "status": "ok",
  "version": {
    "backend": {
      "commit_short": "abc123def",
      "dirty": false,
      "deployed_by": "you",
      "source": "deploy"
    },
    "frontend": {
      "commit_short": "abc123def",
      "dirty": false,
      "source": "build"
    }
  }
}
```

The lobby now serves `/healthz` too (it previously had none). The landing is pure static and has
no `/healthz`, so its stamp is read straight from `https://<apex>/build-info.json`; its row in
the table below shows `-` for the backend. The lobby service has no public URL either: its
`healthz` is read over its socket on the server, its commit is the stamp of the lobby checkout it
runs from, and the `lobby.db` schema version it reports is printed below the table. To see
every component on a server
and how each compares to `origin/main` in one table:

```bash
git fetch origin main
./scripts/deployed-versions.sh --server energetica-game --domain energetica-game.org
```

A `*` next to a commit means it was built or deployed from a tree with uncommitted changes, so
the commit alone does not fully describe what is running. Backend and frontend are stamped
independently because they can be shipped from different states (a frontend-only redeploy is
routine).

## Rollback

(Not yet implemented. Re-deploy a previous local checkout with `deploy-instance.sh`.)
