from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.auth import get_current_user
from energetica.database.player import Player

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/hide_disclaimer", status_code=204)
async def hide_disclaimer(user: Annotated[Player, Depends(get_current_user)]) -> None:
    """Do not show the chat disclaimer again."""
    user.show_chat_disclaimer = False
