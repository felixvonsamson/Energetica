# Deployment Guide

> **Migrating to multi-instance.** The legacy single-instance `vps-setup.sh` has been
> replaced by the `scripts/infra/` setup scripts (RFC Phase 4). The legacy `deploy.sh`
> single-instance flow documented below remains the production path until the Phase 5
> cutover; the new per-instance flow lives alongside it.

## Initial Setup (One-Time) — multi-instance (`scripts/infra/`)

Server-side code delivery uses **rsync, not git** — there is no git checkout on the server.
On the VPS, as root:

```bash
sudo bash scripts/infra/setup-base.sh --deploy-user deploy   # Apache, Python, certbot, firewall,
                                                             # `energetica` group/user, shared dirs
sudo bash scripts/infra/setup-landing.sh --domain energetica-game.org   # apex vhost + TLS
sudo bash scripts/infra/setup-instance.sh autumn-2025 8001 --domain energetica-game.org  # vhost+TLS+unit
```

`setup-instance.sh` provisions the box but ships no code and does **not** start the service.
From your local machine, the first deploy ships the backend and starts it:

```bash
./scripts/deploy-instance.sh --server energetica-game --instance autumn-2025 --domain energetica-game.org
./scripts/deploy-landing.sh  --server energetica-game
./scripts/list-instances.sh  --server energetica-game
```

DNS for the apex and each `{instance}.{domain}` subdomain must resolve to the server before
running the setup scripts (certbot uses the webroot challenge). For a private/unadvertised
instance, `sudo`-edit `/etc/energetica/{instance}/instance.json` before first login.

## Legacy Initial Setup (One-Time) — single instance

The legacy single-instance VPS layout (one `/var/www/energetica`, git-synced) is still served
by `deploy.sh` until Phase 5. New setups should use the multi-instance flow above.

## SSH Configuration

Add to `~/.ssh/config`:

```
Host energetica-game-deploy
    HostName <your-vps-ip-or-domain>
    User deploy
```

Or override with environment variables:

```bash
export DEPLOY_HOST=<hostname>
export DEPLOY_USER=deploy
```

## Regular Deployments

From your local machine:

```bash
./scripts/deploy.sh
```

The script builds the frontend locally, checks git status, pulls code on the VPS, syncs frontend files, and restarts the backend. (~30 seconds total, ~10-30 seconds downtime).

### Options

- `--force` - Deploy with uncommitted local changes
- `--yes` - Skip confirmation prompt
- `--skip-backend` - Sync frontend files only (no git pull, no service restart)
- `--skip-frontend-build` - Skip building frontend (for backend-only changes)

## Rollback

(Not yet implemented. Currently requires manual git reset on the VPS.)

## Monitoring

View logs:

```bash
ssh energetica-game-deploy 'sudo journalctl -u energetica -f'
```

Health check:

```bash
curl https://energetica-game.org/api/
```

Restart service:

```bash
ssh energetica-game-deploy 'sudo systemctl restart energetica'
```

## Troubleshooting

### Service Won't Start

```bash
ssh energetica-game-deploy 'sudo journalctl -u energetica -n 30'
```

### Frontend Not Updating

Make sure you're not using `--skip-frontend-build` on frontend changes.

### SSL Certificate Issues

```bash
ssh energetica-game-deploy 'sudo certbot certificates'
ssh energetica-game-deploy 'sudo certbot renew'
```

### WebSocket Connection Issues

Check Apache proxy modules are enabled:

```bash
ssh energetica-game-deploy 'sudo apache2ctl -M | grep proxy'
```

Should include: `proxy_module`, `proxy_http_module`, `proxy_wstunnel_module`, `rewrite_module`.

If missing, enable and reload:

```bash
ssh energetica-game-deploy 'sudo a2enmod proxy_wstunnel && sudo systemctl reload apache2'
```

## FAQ

**How long is downtime?** ~10-30 seconds while FastAPI service restarts.

**Will players lose progress?** No, game state is preserved in the `instance/` directory.

**Can I deploy without pushing commits?** No, the script requires commits to be pushed.

**Can I deploy with uncommitted changes?** Yes, use `--force` (careful - won't be in git history).

**Can I deploy backend-only changes only?** Yes, use `--skip-frontend-build`.

**How do I check certificate expiration?**

```bash
ssh energetica-game-deploy 'sudo openssl x509 -enddate -noout -in /etc/letsencrypt/live/energetica-game.org/cert.pem'
```
