# Running Energetica with Docker

Docker gives you a fully self-contained environment — no need to install Python or Bun on your machine.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with the Compose plugin (`docker compose version`)

---

## Development

```bash
# 1. Copy the example env file
cp .env.example .env

# 2. Start the backend + Vite dev server
docker compose up
```

| Service | URL | Description |
|---|---|---|
| Frontend (Vite + HMR) | http://localhost:5173 | Edit React files and see changes instantly |
| Backend (FastAPI) | http://localhost:8000 | REST API + Socket.IO |

The frontend proxies `/api`, `/socket.io`, and `/static` to the backend automatically.

### Seed test players

To start with pre-made player accounts instead of an empty game:

```bash
INIT_TEST_PLAYERS=true docker compose up
```

Or set `INIT_TEST_PLAYERS=true` in your `.env` file. This only has an effect on the very first startup when no `instance/` data exists.

### Game speed

Control the simulation speed via environment variables:

```bash
# Fast forward — 1 real second = 1 game hour
CLOCK_TIME=1 IN_GAME_SECONDS_PER_TICK=3600 docker compose up
```

Or set them in `.env`. See `.env.example` for all allowed values.

### Persistent data

Game state lives in Docker named volumes:

```bash
docker volume ls | grep energetica   # list volumes
docker compose down -v               # ⚠ delete all game state
```

To reset and start fresh:

```bash
docker compose down -v && docker compose up
```

---

## Production (with Traefik + auto-TLS)

Traefik handles HTTPS and automatically renews Let's Encrypt certificates.

```bash
# 1. Build the production image
docker build -t energetica:latest .

# 2. Configure environment
cp .env.example .env
# Edit .env and set DOMAIN and LETSENCRYPT_EMAIL

# 3. Create the shared Docker network (once per host)
docker network create web

# 4. Start
docker compose -f docker-compose.prod.yml up -d
```

Your app will be live at `https://<DOMAIN>` within a minute (certificate issuance).

### Deploying updates

```bash
docker build -t energetica:latest .
docker compose -f docker-compose.prod.yml up -d --no-deps backend
```

This rebuilds the image and restarts only the backend, leaving Traefik and volumes untouched.

### View logs

```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

---

## Environment variables reference

See [`.env.example`](../../.env.example) for the full list with descriptions.

| Variable | Default | Description |
|---|---|---|
| `INIT_TEST_PLAYERS` | `false` | Seed test players on first startup |
| `CLOCK_TIME` | `30` | Real seconds per game tick |
| `IN_GAME_SECONDS_PER_TICK` | `240` | In-game seconds per tick |
| `DISABLE_SIGNUPS` | `false` | Prevent new sign-ups |
| `DOMAIN` | — | Public domain (prod only) |
| `LETSENCRYPT_EMAIL` | — | Email for TLS cert notifications (prod only) |
