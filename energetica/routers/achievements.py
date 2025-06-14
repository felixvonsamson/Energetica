"""Routes for achievements."""

from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.auth import get_current_user
from energetica.database.player import Player
from energetica.schemas.achievements import AchievementResponse

router = APIRouter(prefix="/achievements", tags=["Achievements"])


@router.get("")
def get_upcoming_achievements(
    player: Annotated[Player, Depends(get_current_user)],
) -> AchievementResponse:
    """Get the upcoming achievements for this player."""
    return AchievementResponse(achievements=player.package_upcoming_achievements())
