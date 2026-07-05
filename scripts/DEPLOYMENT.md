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
service. The first deploy is what ships the backend and starts it.

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
- `deploy-landing.sh` builds the landing bundle (also baking `VITE_APEX_DOMAIN` so the signup
  CTA targets each instance subdomain) and rsyncs `dist-landing/`. It preserves the
  instance-owned `instances.json` and `instances/` dir. No service restart — the landing is
  pure static.

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
