"""Routes for admin actions. All endpoints require admin authentication."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from energetica.database.player import Player
from energetica.database.user import User
from energetica.schemas.players import PlayerOut
from energetica.utils.auth import get_admin
from energetica.utils.ban import ban_player

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/players")
def list_players(
    _admin: Annotated[User, Depends(get_admin)],
) -> list[PlayerOut]:
    """Get all players for the admin dashboard."""
    return [PlayerOut(id=player.id, username=player.username) for player in Player.all()]


@router.post("/players/{player_id}/ban", status_code=204, response_model=None)
def ban(
    _admin: Annotated[User, Depends(get_admin)],
    player_id: int,
) -> None:
    """Permanently ban a player: delete their account and all game data."""
    player = Player.get(player_id)
    if player is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
    ban_player(player)
