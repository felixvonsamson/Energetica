"""Routes for achievements."""

from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.database.player import Player
from energetica.schemas.achievements import AchievementListOut
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/achievements", tags=["Achievements"])


@router.get("")
def get_upcoming_achievements(
    player: Annotated[Player, Depends(get_settled_player)],
) -> AchievementListOut:
    """Get the upcoming achievements for this player."""
    return AchievementListOut(achievements=player.package_upcoming_achievements())
