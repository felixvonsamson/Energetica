from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.auth import get_current_user
from energetica.database.player import Player
from energetica.schemas.daily_quiz import DailyQuizBase, DailyQuizSubmission
from energetica.utils import misc

router = APIRouter(prefix="/daily_quiz", tags=["Daily Quiz"])


@router.get("")
def get_quiz_question(
    player: Annotated[Player, Depends(get_current_user)],
) -> DailyQuizBase:
    """Get the daily quiz question."""
    return misc.get_quiz_question(player)


@router.post("")
async def submit_quiz_answer(  # noqa: ANN201
    player: Annotated[Player, Depends(get_current_user)],
    submission: DailyQuizSubmission,
):
    """Submit the daily quiz answer from a player."""
    misc.submit_quiz_answer(player, submission.player_answer)
    return misc.get_quiz_question(player)
