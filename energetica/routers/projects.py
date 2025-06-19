"""Routes for API for projects."""

from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.auth import get_current_user
from energetica.database.player import Player

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("")
def get_constructions(user: Annotated[Player, Depends(get_current_user)]):  # noqa: ANN201
    """Get list of facilities under construction for this player."""
    # TODO: create a schema
    projects = user.package_constructions()
    constructions_by_priority = [construction.id for construction in user.constructions_by_priority]
    researches_by_priority = [research.id for research in user.researches_by_priority]
    return (projects, constructions_by_priority, researches_by_priority)
