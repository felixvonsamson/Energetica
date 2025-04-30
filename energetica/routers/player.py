from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.auth import get_current_user
from energetica.database.player import Player
from energetica.routers.chat import router
from energetica.schemas.player import SettingsRequest

router = APIRouter(prefix="/player", tags=["player"])


@router.get("/me")
async def get_me(user: Player = Depends(get_current_user)):
    """Get the current user's information."""

    return {
        "id": user.id,
        "username": user.username,
    }


@router.get("/all")
async def get_all_users():
    """Get all users' information."""

    all_users = Player.all()
    return [
        {
            "id": u.id,
            "username": u.username,
        }
        for u in all_users
    ]


@router.patch("/settings")
async def update_user_settings(
    user: Annotated[Player, Depends(get_current_user)],
    request_data: SettingsRequest,
) -> None:
    if request_data.last_opened_chat_id is not None:
        user.last_opened_chat_id = request_data.last_opened_chat_id
    if request_data.show_disclaimer is not None:
        user.show_chat_disclaimer = request_data.show_disclaimer
