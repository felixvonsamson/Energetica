"""Routes for game engine API."""

from fastapi import APIRouter

from energetica import instance_config
from energetica.globals import engine
from energetica.schemas.game import GameEngineOut

router = APIRouter(prefix="/game", tags=["Game"])


@router.get("/engine")
def get_engine_config() -> GameEngineOut:
    """Get game engine configuration including clock time, simulation speed, and lifecycle boundaries."""
    # None when unconfigured (dev) or unreadable — the in-game app then sees an open-ended run with no
    # freeze, matching the fail-open phase read in instance_config.current_phase (#861).
    try:
        config = instance_config.load_instance_config()
    except instance_config.InstanceConfigError:
        config = None
    return GameEngineOut(
        start_date=engine.start_date,
        wall_clock_seconds_per_tick=engine.clock_time,
        game_seconds_per_tick=engine.in_game_seconds_per_tick,
        freeze_at=config.freeze_at if config else None,
        ended_at=config.ended_at if config else None,
    )
