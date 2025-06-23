"""Routes for API for projects."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from energetica.auth import get_current_user
from energetica.database.ongoing_project import OngoingProject
from energetica.database.player import Player
from energetica.schemas.projects import ProjectIn, ProjectListOut, ProjectOut
from energetica.utils import assets

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("")
def get_constructions(
    player: Annotated[Player, Depends(get_current_user)],
) -> ProjectListOut:
    """Get list of facilities under construction for this player."""
    projects = [
        ProjectOut.from_ongoing_project(project)
        for project in (*player.constructions_by_priority, *player.researches_by_priority)
    ]
    constructions_by_priority = [construction.id for construction in player.constructions_by_priority]
    researches_by_priority = [research.id for research in player.researches_by_priority]
    return ProjectListOut(
        projects=projects,
        construction_queue=constructions_by_priority,
        research_queue=researches_by_priority,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def queue_project(
    player: Annotated[Player, Depends(get_current_user)],
    project: ProjectIn,
    force: bool = False,
) -> None:
    """Start a construction or research project for the player."""
    assets.queue_project(player=player, project_type=project.type, force=force)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_project(
    player: Annotated[Player, Depends(get_current_user)],
    project_id: int,
    force: bool = False,
) -> None:
    """Cancel an ongoing project."""
    project = OngoingProject.getitem(project_id, HTTPException(status_code=status.HTTP_404_NOT_FOUND))
    if project.player != player:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    assets.cancel_project(player=player, project=project, force=force)
    return None


@router.post("/{project_id}:pause")
def request_pause_project(  # noqa: ANN201
    player: Annotated[Player, Depends(get_current_user)],
    project_id: int,
) -> ProjectListOut:
    """Pause or unpause an ongoing project."""
    project = OngoingProject.getitem(project_id, HTTPException(status_code=status.HTTP_404_NOT_FOUND))
    if project.player != player:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    assets.pause_project(player=player, project=project)
    return get_constructions(player)


@router.post("/{project_id}:resume")
def request_resume_project(  # noqa: ANN201
    player: Annotated[Player, Depends(get_current_user)],
    project_id: int,
) -> ProjectListOut:
    """Pause or unpause an ongoing project."""
    project = OngoingProject.getitem(project_id, HTTPException(status_code=status.HTTP_404_NOT_FOUND))
    if project.player != player:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    assets.resume_project(player=player, project=project)
    return get_constructions(player)
