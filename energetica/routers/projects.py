"""Routes for API for projects."""

from typing import Annotated

from fastapi import APIRouter, Depends, status

from energetica.auth import get_current_user
from energetica.database.player import Player
from energetica.schemas.projects import ProjectIn, ProjectsOut
from energetica.utils import assets

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("")
def get_constructions(player: Annotated[Player, Depends(get_current_user)]) -> ProjectsOut:
    """Get list of facilities under construction for this player."""
    projects = [project.to_schema() for project in (*player.constructions_by_priority, *player.researches_by_priority)]
    constructions_by_priority = [construction.id for construction in player.constructions_by_priority]
    researches_by_priority = [research.id for research in player.researches_by_priority]
    return ProjectsOut(
        projects=projects,
        construction_queue=constructions_by_priority,
        research_queue=researches_by_priority,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def queue_project(
    player: Annotated[Player, Depends(get_current_user)],
    project: ProjectIn,
    force: bool = False,
) -> ProjectsOut:
    """Start a construction or research project for the player."""
    assets.queue_project(
        player=player,
        project_type=project.type,
        force=force,
    )
    return get_constructions(player)
