from fastapi import APIRouter, Depends

from energetica.auth import get_current_user
from energetica.database.player import Player

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/hide_disclaimer")
async def hide_disclaimer(user: Player = Depends(get_current_user)):
    """
    Hide the chat disclaimer for the user."""
    user.show_chat_disclaimer = False
    return {"success": True}
