from fastapi import APIRouter, Depends

from energetica.auth import get_current_user
from energetica.database.player import Player

router = APIRouter(prefix="/players", tags=["Player"])


@router.get("/me")
async def get_me(user: Player = Depends(get_current_user)) -> PlayerOut:
    """Get the current user's information."""
    return PlayerOut(
        id=user.id,
        username=user.username,
    )


@router.get("")
async def get_all_users() -> list[PlayerOut]:
    """Get all users' information."""
    all_users = Player.all()
    return [
        PlayerOut(
            id=u.id,
            username=u.username,
        )
        for u in all_users
    ]
