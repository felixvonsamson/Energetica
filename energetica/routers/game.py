"""Routes for game engine API."""

from fastapi import APIRouter

from energetica.globals import engine
from energetica.schemas.game import GameEngineOut

router = APIRouter(prefix="/game", tags=["Game"])


@router.get("/engine")
def get_engine_config() -> GameEngineOut:
    """Get game engine configuration including clock time and simulation speed."""
    return GameEngineOut(
        start_date=engine.start_date,
        wall_clock_seconds_per_tick=engine.clock_time,
        game_seconds_per_tick=engine.in_game_seconds_per_tick,
    )
