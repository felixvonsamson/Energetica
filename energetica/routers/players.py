"""Routes relating to players."""

from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.database.player import Player
from energetica.globals import engine
from energetica.routers.chats import router
from energetica.schemas.players import (
    GameStateOut,
    MoneyOut,
    PlayerOut,
    ProfileOut,
    ResourcesOut,
    SettingsOut,
    SettingsPatch,
    WorkersOut,
)
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/players", tags=["Players"])


@router.get("/game-state")
def get_game_state() -> GameStateOut:
    """Get current game state information including the current tick."""
    return GameStateOut(current_tick=engine.total_t)


@router.get("/me")
def get_me(user: Player = Depends(get_settled_player)) -> PlayerOut:
    """Get the current user's information."""
    return PlayerOut.from_player(user)


@router.get("")
def get_all_players() -> list[PlayerOut]:
    """Get all user ids and usernames, excluding admins."""
    return [PlayerOut.from_player(player) for player in Player.all()]


@router.get("/me/settings")
def get_user_settings(
    player: Annotated[Player, Depends(get_settled_player)],
) -> SettingsOut:
    """Get the current user's settings."""
    return SettingsOut(show_disclaimer=player.show_chat_disclaimer)


@router.patch("/me/settings", status_code=204)
def update_user_settings(
    player: Annotated[Player, Depends(get_settled_player)],
    request_data: SettingsPatch,
) -> None:
    if request_data.show_disclaimer is not None:
        player.show_chat_disclaimer = request_data.show_disclaimer

    # Invalidate queries so frontend updates
    player.invalidate_queries(["players", "me", "settings"])


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


@router.get("/me/resources")
def get_resources(
    player: Annotated[Player, Depends(get_settled_player)],
) -> ResourcesOut:
    return ResourcesOut.from_player(player)


@router.get("/me/profile")
def get_profile(
    player: Annotated[Player, Depends(get_settled_player)],
) -> ProfileOut:
    """Get the player's complete profile information including levels and statistics."""
    return ProfileOut.from_player(player)
