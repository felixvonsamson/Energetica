from fastapi import APIRouter, Depends

from energetica.auth import get_current_user
from energetica.database.player import Player

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
