"""Schemas for game engine data API."""

import datetime

from pydantic import AwareDatetime, BaseModel


class GameEngineOut(BaseModel):
    """Game engine configuration and timing data."""

    start_date: datetime.datetime
    wall_clock_seconds_per_tick: int
    game_seconds_per_tick: int
    # Lifecycle boundaries (#861), so the in-game app can derive its phase client-side (mirrored
    # ``derivePhase``) instead of learning about freeze only from a rejected write. Absolute and
    # tz-aware, sourced from this instance's ``instance.json``; ``null`` on an unconfigured/open-ended
    # run (dev, or a run with no scheduled end). The in-game freeze UI that consumes these — banner,
    # disabled controls, countdown — is built in T8 (#866).
    freeze_at: AwareDatetime | None = None
    ended_at: AwareDatetime | None = None
