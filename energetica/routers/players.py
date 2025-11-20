"""Routes relating to players."""

from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.database.player import Player
from energetica.routers.chats import router
from energetica.schemas.players import MoneyOut, PlayerOut, SettingsPatch, UIStatePatch, WorkersOut
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/players", tags=["Players"])


@router.get("/me")
def get_me(user: Player = Depends(get_settled_player)) -> PlayerOut:
    """Get the current user's information."""
    return PlayerOut(
        id=user.id,
        username=user.username,
    )


@router.get("")
def get_all_users() -> list[PlayerOut]:
    """Get all user ids and usernames, excluding admins."""
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
    player: Annotated[Player, Depends(get_settled_player)],
    request_data: SettingsPatch,
) -> None:
    if request_data.show_disclaimer is not None:
        player.show_chat_disclaimer = request_data.show_disclaimer


@router.patch("/me/ui-state", status_code=204)
def update_ui_state(
    player: Annotated[Player, Depends(get_settled_player)],
    request_data: UIStatePatch,
) -> None:
    if request_data.last_opened_chat_id is not None:
        player.last_opened_chat_id = request_data.last_opened_chat_id


@router.get("/me/money")
def get_money(
    player: Annotated[Player, Depends(get_settled_player)],
) -> MoneyOut:
    return MoneyOut.from_player(player)


@router.get("/me/workers")
def get_workers(
    player: Annotated[Player, Depends(get_settled_player)],
) -> WorkersOut:
    return WorkersOut.from_player(player)
