"""Routes for the daily quiz."""

from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.database.player import Player
from energetica.schemas.daily_quiz import DailyQuizBase, DailyQuizSubmitRequest
from energetica.utils import misc
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/daily-quiz", tags=["Daily Quiz"])


@router.get("", response_model_exclude_unset=True)
def get_quiz_question(
    player: Annotated[Player, Depends(get_settled_player)],
) -> DailyQuizBase:
    """Get the daily quiz question."""
    return misc.get_quiz_question(player)


@router.post("", response_model_exclude_unset=True)
def submit_quiz_answer(
    player: Annotated[Player, Depends(get_settled_player)],
    submission: DailyQuizSubmitRequest,
) -> DailyQuizBase:
    """Submit the daily quiz answer from a player."""
    misc.submit_quiz_answer(player, submission.player_answer)
    return misc.get_quiz_question(player)
