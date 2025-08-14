"""Routes for API for projects."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from energetica.utils.auth import get_current_user
from energetica.database.ongoing_project import OngoingProject
from energetica.database.player import Player
from energetica.schemas.projects import ProjectIn, ProjectListOut
from energetica.utils import assets

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("")
def get_constructions(
    player: Annotated[Player, Depends(get_current_user)],
) -> ProjectListOut:
    """Get list of facilities under construction for this player."""
    return ProjectListOut.from_player(player)


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
def queue_project(
    player: Annotated[Player, Depends(get_current_user)],
    project: ProjectIn,
    force: bool = False,
) -> None:
    """Start a construction or research project for the player."""
    assets.queue_project(player=player, project_type=project.type, force=force)


@router.post("/{project_id}:cancel")
def cancel_project(
    player: Annotated[Player, Depends(get_current_user)],
    project_id: int,
    force: bool = False,
) -> ProjectListOut:
    """Cancel an ongoing project."""
    project = OngoingProject.getitem(project_id, HTTPException(status_code=status.HTTP_404_NOT_FOUND))
    if project.player != player:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    assets.cancel_project(player=player, project=project, force=force)
    return get_constructions(player)


@router.post("/{project_id}:pause")
def request_pause_project(
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
def request_resume_project(
    player: Annotated[Player, Depends(get_current_user)],
    project_id: int,
) -> ProjectListOut:
    """Pause or unpause an ongoing project."""
    project = OngoingProject.getitem(project_id, HTTPException(status_code=status.HTTP_404_NOT_FOUND))
    if project.player != player:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    assets.resume_project(player=player, project=project)
    return get_constructions(player)


@router.post("/{project_id}:decrease-priority")
async def decrease_project_priority(
    player: Annotated[Player, Depends(get_current_user)],
    project_id: int,
) -> ProjectListOut:
    """Decrease the priority of a projects."""
    project = OngoingProject.getitem(project_id, HTTPException(status_code=status.HTTP_404_NOT_FOUND))
    if project.player != player:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    assets.decrease_project_priority(player=player, project=project)
    return get_constructions(player)


@router.post("/{project_id}:increase-priority")
async def increase_project_priority(
    player: Annotated[Player, Depends(get_current_user)],
    project_id: int,
) -> ProjectListOut:
    """Increase the priority of a projects."""
    project = OngoingProject.getitem(project_id, HTTPException(status_code=status.HTTP_404_NOT_FOUND))
    if project.player != player:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    assets.increase_project_priority(player=player, project=project)
    return get_constructions(player)
