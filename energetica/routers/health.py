"""Public health-check endpoint.

Designed to catch the failure modes that a plain /openapi.json probe missed
during the PR #791 deploy: a replay job crashing in an APScheduler background
thread while FastAPI itself stayed up and 200-OK.

The endpoint is intentionally unauthenticated. It exposes only diagnostic data
(commit sha, tick counters, scheduler error count, presence of static assets),
not game state.
"""

from __future__ import annotations

import datetime
import os
import time
from typing import Literal

from fastapi import APIRouter

from energetica.database.player import Player
from energetica.database.network import Network
from energetica.globals import engine

router = APIRouter(prefix="", tags=["Health"])

STATIC_INDEX_PATH = "energetica/static/app/index.html"
PICKLE_PATH = "instance/engine_data.pck"

Status = Literal["loading_actions", "resimulating", "ok", "degraded"]


def _ticks_per_min_last_5m() -> float | None:
    """Tick rate over the trailing five minutes. None if no ticks recorded."""
    if not engine.recent_tick_timestamps:
        return None
    cutoff = time.time() - 300
    # Snapshot first to avoid concurrent mutation by tick() (which holds engine.lock).
    snapshot = list(engine.recent_tick_timestamps)
    recent = [t for t in snapshot if t >= cutoff]
    if not recent:
        return 0.0
    return round(len(recent) / 5.0, 2)


def _determine_status() -> tuple[Status, dict | None]:
    """Pick a status and (optionally) replay progress dict."""
    if engine.clock_time is None or engine.total_t is None:
        # Currently unreachable from a bound port — the actions-history parse runs
        # synchronously before uvicorn binds — but exposed for future-proofing if
        # that parse moves into the lifespan.
        return "loading_actions", None

    if engine.serve_local:
        progress: dict | None = None
        if engine.resim_target_tick is not None:
            progress = {
                "from_tick": engine.resim_start_tick,
                "to_tick": engine.resim_target_tick,
                "current_tick": engine.total_t,
            }
        return "resimulating", progress

    if engine.scheduler_exception_count > 0:
        return "degraded", None

    # serve_local is False — recurring tick job should be firing every clock_time seconds.
    if engine.last_tick_at is None:
        # Server just transitioned out of replay and hasn't ticked yet.
        # This is a narrow window; treat as ok rather than degraded.
        return "ok", None

    age = (datetime.datetime.now(datetime.timezone.utc) - engine.last_tick_at).total_seconds()
    if age > 2 * engine.clock_time:
        return "degraded", None
    return "ok", None


@router.get("/healthz", include_in_schema=False)
def healthz() -> dict:
    status, resim_progress = _determine_status()

    pickle_mtime: str | None = None
    if os.path.isfile(PICKLE_PATH):
        pickle_mtime = (
            datetime.datetime.fromtimestamp(os.path.getmtime(PICKLE_PATH), tz=datetime.timezone.utc)
            .isoformat()
            .replace("+00:00", "Z")
        )

    uptime_s = int((datetime.datetime.now(datetime.timezone.utc) - engine.server_start_time).total_seconds())

    body: dict = {
        "status": status,
        "git_sha": engine.git_sha,
        "uptime_s": uptime_s,
        "engine": {
            "loaded": engine.clock_time is not None,
            "last_tick_at": engine.last_tick_at.isoformat().replace("+00:00", "Z")
            if engine.last_tick_at is not None
            else None,
            "total_t": engine.total_t,
            "ticks_per_min_last_5m": _ticks_per_min_last_5m(),
            "players": len(Player.all()) if engine.clock_time is not None else None,
            "networks": len(Network.all()) if engine.clock_time is not None else None,
            "scheduler_exception_count": engine.scheduler_exception_count,
        },
        "pickle_mtime": pickle_mtime,
        "static_app_index_present": os.path.isfile(STATIC_INDEX_PATH),
    }
    if resim_progress is not None:
        body["resim_progress"] = resim_progress
    return body
