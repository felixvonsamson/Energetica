# Deployment Guide

## Initial Setup (One-Time)

Run this on your VPS:

```bash
sudo bash scripts/vps-setup.sh
```

The script will prompt you for:

- Git repository branch to deploy
- Confirmation that your domain points to the VPS

It handles: Apache, Python venv, Node.js, SSL (Let's Encrypt), systemd service, firewall.

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
