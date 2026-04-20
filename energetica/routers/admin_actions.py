"""Routes for admin actions. All endpoints require admin authentication."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.database.player import Player
from energetica.database.user import User
from energetica.schemas.admin import AdminPlayerOut
from energetica.utils.auth import get_admin

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/players")
def list_players(
    _admin: Annotated[User, Depends(get_admin)],
) -> list[AdminPlayerOut]:
    """Get all players for the admin dashboard."""
    return [AdminPlayerOut(id=player.id, username=player.username) for player in Player.all()]
