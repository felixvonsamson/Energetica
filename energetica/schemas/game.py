"""Schemas for game engine data API."""

import datetime

from pydantic import AwareDatetime, BaseModel


class GameEngineOut(BaseModel):
    """Game engine configuration and timing data."""

    start_date: datetime.datetime
    wall_clock_seconds_per_tick: int
    game_seconds_per_tick: int
    # Lifecycle boundaries (#861 / #862), so the in-game app can derive its own phase client-side
    # (mirrored ``derivePhase``) instead of learning about a transition only from a rejected write.
    # Absolute and tz-aware, sourced from this instance's ``instance.json``; ``null`` on an
    # unconfigured/open-ended run (dev, or a run with no scheduled end). ``start_date`` above is the
    # *sim epoch* — during an announced window it is still process-start time and only re-anchors to
    # the real start moment when play begins (see ``tick_execution.state_update``), so the client must
    # derive phase from ``starts_at`` here, never from ``start_date``. The announced waiting screen
    # (#862, T4) consumes ``starts_at``; the in-game freeze UI (#866, T8) consumes freeze/ended.
    starts_at: AwareDatetime | None = None
    freeze_at: AwareDatetime | None = None
    ended_at: AwareDatetime | None = None
