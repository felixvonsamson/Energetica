# Deployment Guide

Energetica deploys as one **landing** site on the apex domain plus one or more
**instances**, each on its own subdomain. Apache serves all static content
(landing, app bundle, images, service worker, PWA manifest) directly from disk;
uvicorn handles only `/api`, `/socket.io`, and `/logout`. See
`docs/architecture/static-serving-and-deployment.md` for the full design.

Server-side code delivery uses **rsync, not git** — there is no git checkout on
the server.

## Initial Setup (One-Time)

On the VPS, as root:

```bash
sudo bash scripts/infra/setup-base.sh --deploy-user deploy   # Apache, Python, certbot, firewall,
                                                             # `energetica` group/user, shared dirs,
                                                             # shared secret + server.json
sudo bash scripts/infra/setup-landing.sh --domain energetica-game.org   # apex vhost + TLS
sudo bash scripts/infra/setup-lobby.sh --domain energetica-game.org     # lobby vhost+TLS+unit
sudo bash scripts/infra/setup-instance.sh autumn-2025 8002 --domain energetica-game.org  # vhost+TLS+unit
```

`setup-instance.sh` provisions the box (directory, venv, `/etc/energetica/{slug}/instance.json`,
vhost+TLS, enabled-but-unstarted unit) but ships **no** code and does **not** start the
service. The first deploy is what ships the backend and starts it. `setup-lobby.sh` works
the same way for the lobby service.

Every service needs its own uvicorn port: the lobby defaults to **8001** (`--port`
overrides), so give each instance a different one. `setup-lobby.sh` refuses a port
already claimed by another `energetica-*` unit.

DNS for the apex and each `{instance}.{domain}` subdomain must resolve to the server before
running the setup scripts (certbot uses the webroot challenge). For a private/unadvertised
instance, `sudo`-edit `/etc/energetica/{instance}/instance.json` before the first login.

## Regular Deployments

From your local machine:

```bash
./scripts/deploy-instance.sh --server energetica-game --instance autumn-2025 --domain energetica-game.org
./scripts/deploy-landing.sh  --server energetica-game --domain energetica-game.org
./scripts/deploy-lobby.sh    --server energetica-game --domain energetica-game.org
./scripts/list-instances.sh  --server energetica-game
```

- `deploy-instance.sh` builds the app bundle locally (baking `VITE_APEX_DOMAIN` so
  cross-origin links resolve), rsyncs the Python backend + bundle, reinstalls deps into the
  server venv, restarts the service, and polls `/healthz`. On restart the instance re-reads
  `instance.json` and re-publishes its landing fragment, so admin policy edits take effect.
- `deploy-landing.sh` builds the landing bundle (also baking `VITE_APEX_DOMAIN` so the
  "Play now" / "Log In" CTAs target `lobby.{apex}`) and rsyncs `dist-landing/`. It preserves
  the instance-owned `instances.json` and `instances/` dir. No service restart — the landing
  is pure static.

- `deploy-lobby.sh` builds the lobby bundle (no apex baking — the lobby derives it from
  its own hostname at runtime), rsyncs the backend + `dist-lobby/` to
  `/var/www/energetica-lobby`, reinstalls deps, restarts `energetica-lobby`, and
  health-checks the vhost. **Hard precondition:** it refuses to deploy while the
  `instance_membership` table is absent from `accounts.db` — Phase A (write-on-settle +
  `scripts/backfill-instance-membership.py`) must be live first, else the lobby silently
  shows every existing player zero runs (`docs/architecture/lobby.md` § Phasing).

`instance.json` lives outside the deploy dir (`/etc/energetica/{instance}/`) and is
admin-owned, so deploys never touch it. The server-wide `/etc/energetica/server.json`
(the lobby's signup toggle) is likewise admin-owned; `sudo`-edit it and the lobby picks
the change up on the next request — no restart.

### Options

`deploy-instance.sh`: `--yes` (skip confirm), `--skip-build`, `--skip-deps`, `--user <ssh-user>`.
`deploy-landing.sh`: `--yes`, `--skip-build`, `--user <ssh-user>`.
`deploy-lobby.sh`: `--yes`, `--skip-build`, `--skip-deps`, `--user <ssh-user>`.

All inputs also accept env vars (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_DOMAIN`), so the
scripts run unattended from CI.

## Lobby cutover (#817) — one-time forced global re-login

The Phase C cutover flips instances to the server-wide SSO model (`docs/architecture/lobby.md`
§ Phasing, ADR-0002/0003). It is a **coordinated flag day**, not a quiet deploy, because it
**logs every player out once**:

- Instances stop minting their own session and instead validate the lobby's shared-secret,
  parent-domain cookie. On its first post-cutover restart an instance adopts the shared
  `/var/lib/energetica/secret_key.txt`, so any session it signed with its **old per-instance**
  secret no longer validates → those players must log in again at the lobby.
- The SSO cookie is renamed `session` → `energetica_session`. Pre-cutover host-only `session`
  cookies (and any Phase-B lobby `session` cookie) are simply ignored by the new code; they
  linger harmlessly until they expire. This distinct name is deliberate — two same-named
  cookies on a run subdomain have an RFC-6265-undefined precedence and could otherwise loop a
  returning player between run and lobby.

**Announce the re-login before deploying.** Deploy order on the flag day:

1. Deploy the lobby if its code changed (`deploy-lobby.sh`) — Phase A/B preconditions already
   hold in production.
2. Deploy each instance (`deploy-instance.sh …`). The restart adopts the shared secret and the
   new cookie name; the entry gate (`GET /auth/me`) now provisions the local `User` on first
   authenticated visit, access-policy-gated. Instance login/signup/logout/change-password and
   the legacy root `/logout` are gone — unauthenticated app hits redirect to `lobby.{apex}`.
3. Deploy the landing (`deploy-landing.sh`) so its CTAs point at the lobby.
4. Smoke-test SSO on prod: log in at the lobby → open a run → no re-auth → the top-right
   switcher lists your settled runs → a private run you're not on gives a clean 403 → logout
   from a run clears the session everywhere.

Not yet migrated (tracked separately): the `players.txt` → admin-bootstrap swap and removal of
per-instance `disable_signups` (C0); the CI raw-HTML guard (C4, ADR-0002); and a lobby
change-password UI (the endpoint exists; the instance dialog was removed).

## SSH Configuration

Add to `~/.ssh/config`:

```
Host energetica-game
    HostName <your-vps-ip-or-domain>
    User deploy
```

Or override with environment variables (`DEPLOY_HOST`, `DEPLOY_USER`).

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

## Troubleshooting

### Service won't start

```bash
ssh energetica-game 'sudo journalctl -u energetica-autumn-2025 -n 30'
```

### SSL certificate issues

```bash
ssh energetica-game 'sudo certbot certificates'
ssh energetica-game 'sudo certbot renew'
```

### WebSocket connection issues

Check Apache proxy modules are enabled:

```bash
ssh energetica-game 'sudo apache2ctl -M | grep proxy'
```

Should include `proxy_module`, `proxy_http_module`, `proxy_wstunnel_module`, `rewrite_module`.
If missing:

```bash
ssh energetica-game 'sudo a2enmod proxy proxy_http proxy_wstunnel rewrite && sudo systemctl reload apache2'
```

## FAQ

**How long is downtime?** ~10-30 seconds per instance while its uvicorn service restarts.
Apache and other instances keep serving throughout.

**Will players lose progress?** No — game state is preserved in the instance's `instance/` directory.

**Can I deploy a backend-only change?** Yes, use `--skip-build` on `deploy-instance.sh`.

**How do I check certificate expiration?**

```bash
ssh energetica-game 'sudo openssl x509 -enddate -noout -in /etc/letsencrypt/live/autumn-2025.energetica-game.org/cert.pem'
```
