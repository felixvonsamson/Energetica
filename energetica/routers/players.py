"""Routes relating to players."""

from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.auth import get_current_user
from energetica.database.player import Player
from energetica.routers.chats import router
from energetica.schemas.players import PlayerOut, SettingsRequest, UIStateUpdate

router = APIRouter(prefix="/players", tags=["Players"])


@router.get("/me")
def get_me(user: Player = Depends(get_current_user)) -> PlayerOut:
    """Get the current user's information."""
    return PlayerOut(
        id=user.id,
        username=user.username,
    )


@router.get("")
def get_all_users() -> list[PlayerOut]:
    """Get all users' information."""
    all_users = Player.all()
    return [
        PlayerOut(
            id=u.id,
            username=u.username,
        )
        for u in all_users
    ]


@router.patch("/me/settings", status_code=204)
def update_user_settings(
    user: Annotated[Player, Depends(get_current_user)],
    request_data: SettingsRequest,
) -> None:
    if request_data.show_disclaimer is not None:
        user.show_chat_disclaimer = request_data.show_disclaimer


@router.patch("/me/ui-state", status_code=204)
def update_ui_state(
    user: Annotated[Player, Depends(get_current_user)],
    request_data: UIStateUpdate,
) -> None:
    if request_data.last_opened_chat_id is not None:
        user.last_opened_chat_id = request_data.last_opened_chat_id
