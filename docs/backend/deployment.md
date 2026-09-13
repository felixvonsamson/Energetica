# Deployment Guide

Energetica deploys as one **landing** site on the apex domain plus one or more
**instances**, each on its own subdomain. Apache serves all static content
(landing, app bundle, images, service worker, PWA manifest) directly from disk;
uvicorn handles only `/api`, `/socket.io`, and `/logout`. See
`docs/architecture/static-serving-and-deployment.md` for the full design.

Server-side code delivery uses **rsync, not git** — there is no git checkout on
the server.

## Initial Setup (One-Time)

`scripts/infra/*` (the `setup-*.sh` scripts below) are never shipped by the normal deploy
scripts — Option A means there is no git checkout on the server for anything to rsync into
before the first instance or the lobby exists. Push them from your machine first:

```bash
./scripts/push-bootstrap.sh --server energetica-game
```

This flattens `scripts/infra/*` into `/tmp` on the server (deliberately not a persistent
path — these are meant to be re-synced immediately before use, not trusted to still be current
later). Then, on the VPS, as root:

```bash
sudo bash /tmp/setup-base.sh                                    # Apache, Python, certbot, firewall,
                                                                 # `energetica` group/user, shared dirs,
                                                                 # shared secret + server.json
                                                                 # (the OS "deploy" user must already exist)
sudo bash /tmp/setup-landing.sh --domain energetica-game.org    # apex vhost + TLS
sudo bash /tmp/setup-lobby.sh --domain energetica-game.org      # lobby vhost+TLS+unit
sudo bash /tmp/setup-instance.sh autumn-2025 8004 --domain energetica-game.org  # vhost+TLS+unit
```

`setup-instance.sh` provisions the box (directory, venv, `/etc/energetica/{slug}/instance.json`,
vhost+TLS, enabled-but-unstarted unit) but ships **no** code and does **not** start the
service. The first deploy is what ships the backend and starts it. `setup-lobby.sh` works
the same way for the lobby service.

Every service needs its own uvicorn port: the lobby defaults to **8002** (`--port`
overrides), so give each instance a different one. `setup-lobby.sh` refuses a port
already claimed by another `energetica-*` unit.

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
  admin policy edits take effect.
  Downtime is ~10-30 seconds while the restart happens — Apache and every other instance keep
  serving throughout. Game state isn't touched: it lives in the instance's own `instance/`
  directory, which the rsync step excludes.
- `deploy-landing.sh` builds the landing bundle (also baking `VITE_APEX_DOMAIN` so the
  "Play now" / "Log In" CTAs target `lobby.{apex}`) and rsyncs `dist-landing/`. It preserves
  the instance-owned `instances.json` and `instances/` dir. No service restart — the landing
  is pure static.

- `deploy-lobby.sh` builds the lobby bundle (no apex baking — the lobby derives it from
  its own hostname at runtime), rsyncs the backend + `dist-lobby/` to
  `/var/www/energetica-lobby`, installs the backend wheel into the server venv, restarts
  `energetica-lobby`, and health-checks the vhost. **Hard precondition:** it refuses to
  deploy while the `instance_membership` table is absent from `accounts.db` — Phase A
  (write-on-settle) must be live first, else the lobby silently shows every existing
  player zero runs (`docs/architecture/lobby.md` § Phasing).

Each deploy script also syncs a target-specific `scripts/` subset, flattened with no
subfolder on the server: `deploy-instance.sh` ships `scripts/instance/` (currently
`export_instance_to_csv.py`), `deploy-lobby.sh` ships `scripts/lobby/` (currently
`grant-facilitator.py`, `whitelist-run.py` — both touch the shared `accounts.db`, so they
live with the lobby, not with any single instance). `scripts/dev/`, `scripts/lib/`, and
`scripts/*.ts` never touch the server.

`instance.json` lives outside the deploy dir (`/etc/energetica/{instance}/`) and is
admin-owned, so deploys never touch it. The server-wide `/etc/energetica/server.json`
(the lobby's signup toggle) is likewise admin-owned; `sudo`-edit it and the lobby picks
the change up on the next request — no restart.

### Options

`deploy-instance.sh`: `--yes` (skip confirm), `--skip-build`.
`deploy-landing.sh`: `--yes`, `--skip-build`.
`deploy-lobby.sh`: `--yes`, `--skip-build`.

`--skip-build` skips only the frontend bundle. There is no way to skip installing the backend:
the backend lives under `src/` and is imported as an installed package, so a deploy that did
not install it would leave the service unable to start.

The SSH user is always `deploy` (hardcoded — never varied across this project's history).
`--server`/`--domain` also accept env vars (`DEPLOY_HOST`, `DEPLOY_DOMAIN`), so the scripts
run unattended from CI.

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

`accounts.db` (`/var/lib/energetica/accounts.db`) is shared by every instance on the VPS —
back it up alongside the per-instance state.

## Monitoring

View logs / restart / health-check a single instance:

```bash
ssh energetica-game 'sudo journalctl -u energetica-autumn-2025 -f'
ssh energetica-game 'sudo systemctl restart energetica-autumn-2025'
curl https://autumn-2025.energetica-game.org/healthz
```

## Checking what is deployed

The server has no git checkout (deploys rsync with `--exclude='.git'`), so a component cannot
read its own commit from git. Instead each half is stamped, and both are reported by `/healthz`:

- **Backend** — `deploy-instance.sh` / `deploy-lobby.sh` write `DEPLOYED_VERSION.json` to the
  deploy root at rsync time, capturing the commit, branch, dirty flag, deployer, and timestamp.
- **Frontend** — the vite build writes `build-info.json` into the bundle it emits.

`/healthz` reads both and returns a `version` block:

```json
{ "status": "ok",
  "version": {
    "backend":  { "commit_short": "abc123def", "dirty": false, "deployed_by": "you", "source": "deploy" },
    "frontend": { "commit_short": "abc123def", "dirty": false, "source": "build" } } }
```

The lobby now serves `/healthz` too (it previously had none). To see every component on a server
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
