"""``GET /api/v1/run``: which kind of Run this instance is, for the frontend to load at startup (#994).

Both apps serve it, each reporting the mode it was built for, so the frontend can show the Workshop
pages in a Workshop Run instead of the persistent world's settle flow. It reports the running app's
mode rather than re-reading ``instance.json``, because changing the mode in that file has no effect
until the process restarts. It needs no session: the mode is not secret, and the frontend needs it
before it knows whether anyone is signed in.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

# The ``mode`` tags of ``instance_config.RunMode``. ``test_run_route.py`` holds the two equal.
RunModeTag = Literal["freeplay", "workshop"]


class RunOut(BaseModel):
    """What the frontend needs to know about this Run before choosing which pages to show."""

    mode: RunModeTag = Field(description="The kind of Run: the persistent world (freeplay) or a Workshop")


def run_router(mode: RunModeTag) -> APIRouter:
    """The ``/run`` route for an app running a Run of ``mode``."""
    router = APIRouter(prefix="/run", tags=["Run"])

    @router.get("")
    def get_run() -> RunOut:
        """Which kind of Run this instance is."""
        return RunOut(mode=mode)

    return router
