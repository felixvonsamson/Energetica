# ──────────────────────────────────────────────────────────────────────────────
# Stage 1: Build the React frontend
# ──────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1 AS builder

WORKDIR /app

# Install frontend dependencies first (layer-cached until lockfile changes)
COPY frontend/package.json frontend/bun.lock ./frontend/
RUN cd frontend && bun install --frozen-lockfile

# Copy the rest of the source needed for the build
COPY frontend/ ./frontend/
COPY scripts/ ./scripts/
COPY energetica/static/ ./energetica/static/

# Build → outputs to energetica/static/react/ (configured in vite.config.ts)
RUN cd frontend && bun run build

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2: Production runtime
# ──────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

# Install build tools needed for C extensions (e.g. noise), then clean up
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer-cached until requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY energetica/ ./energetica/
COPY main.py .
COPY map_generation/ ./map_generation/

# Overlay the built frontend assets from stage 1
COPY --from=builder /app/energetica/static/react/ ./energetica/static/react/
COPY --from=builder /app/energetica/static/service-worker.js ./energetica/static/service-worker.js

# Copy the entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# instance/ and checkpoints/ are expected to be mounted as volumes
VOLUME ["/app/instance", "/app/checkpoints"]

EXPOSE 8000

ENV ENV=prod

ENTRYPOINT ["docker-entrypoint.sh"]
