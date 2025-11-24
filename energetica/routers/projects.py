"""Routes for API for projects."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from energetica.database.ongoing_project import OngoingProject
from energetica.database.player import Player
from energetica.schemas.projects import (
    ExtractionFacilityCatalogListOut,
    FunctionalFacilityCatalogListOut,
    PowerFacilityCatalogListOut,
    ProjectIn,
    ProjectListOut,
    StorageFacilityCatalogListOut,
    TechnologyCatalogListOut,
)
from energetica.utils import assets
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("")
def get_projects(
    player: Annotated[Player, Depends(get_settled_player)],
) -> ProjectListOut:
    """Get list of facilities under construction for this player."""
    return ProjectListOut.from_player(player)


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
def queue_project(
    player: Annotated[Player, Depends(get_settled_player)],
    project: ProjectIn,
    force: bool = False,
) -> None:
    """Start a construction or research project for the player."""
    assets.queue_project(player=player, project_type=project.type, force=force)


@router.post("/{project_id}:cancel")
def cancel_project(
    player: Annotated[Player, Depends(get_settled_player)],
    project_id: int,
    force: bool = False,
) -> ProjectListOut:
    """Cancel an ongoing project."""
    project = OngoingProject.getitem(project_id, HTTPException(status_code=status.HTTP_404_NOT_FOUND))
    if project.player != player:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    assets.cancel_project(player=player, project=project, force=force)
    return get_projects(player)


@router.post("/{project_id}:pause")
def request_pause_project(
    player: Annotated[Player, Depends(get_settled_player)],
    project_id: int,
) -> ProjectListOut:
    """Pause or unpause an ongoing project."""
    project = OngoingProject.getitem(project_id, HTTPException(status_code=status.HTTP_404_NOT_FOUND))
    if project.player != player:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    assets.pause_project(player=player, project=project)
    return get_projects(player)


@router.post("/{project_id}:resume")
def request_resume_project(
    player: Annotated[Player, Depends(get_settled_player)],
    project_id: int,
) -> ProjectListOut:
    """Pause or unpause an ongoing project."""
    project = OngoingProject.getitem(project_id, HTTPException(status_code=status.HTTP_404_NOT_FOUND))
    if project.player != player:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    assets.resume_project(player=player, project=project)
    return get_projects(player)


@router.post("/{project_id}:decrease-priority")
async def decrease_project_priority(
    player: Annotated[Player, Depends(get_settled_player)],
    project_id: int,
) -> ProjectListOut:
    """Decrease the priority of a projects."""
    project = OngoingProject.getitem(project_id, HTTPException(status_code=status.HTTP_404_NOT_FOUND))
    if project.player != player:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    assets.decrease_project_priority(player=player, project=project)
    return get_projects(player)


@router.post("/{project_id}:increase-priority")
async def increase_project_priority(
    player: Annotated[Player, Depends(get_settled_player)],
    project_id: int,
) -> ProjectListOut:
    """Increase the priority of a projects."""
    project = OngoingProject.getitem(project_id, HTTPException(status_code=status.HTTP_404_NOT_FOUND))
    if project.player != player:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    assets.increase_project_priority(player=player, project=project)
    return get_projects(player)


@router.get("/catalog/power-facilities")
def get_power_facilities_catalog(
    player: Annotated[Player, Depends(get_settled_player)],
) -> PowerFacilityCatalogListOut:
    """Get the catalog of all power facilities available for construction for this player."""
    return PowerFacilityCatalogListOut.from_player(player)


@router.get("/catalog/storage-facilities")
def get_storage_facilities_catalog(
    player: Annotated[Player, Depends(get_settled_player)],
) -> StorageFacilityCatalogListOut:
    """Get the catalog of all storage facilities available for construction for this player."""
    return StorageFacilityCatalogListOut.from_player(player)


@router.get("/catalog/extraction-facilities")
def get_extraction_facilities_catalog(
    player: Annotated[Player, Depends(get_settled_player)],
) -> ExtractionFacilityCatalogListOut:
    """Get the catalog of all extraction facilities available for construction for this player."""
    return ExtractionFacilityCatalogListOut.from_player(player)


@router.get("/catalog/functional-facilities")
def get_functional_facilities_catalog(
    player: Annotated[Player, Depends(get_settled_player)],
) -> FunctionalFacilityCatalogListOut:
    """Get the catalog of all functional facilities available for construction for this player."""
    return FunctionalFacilityCatalogListOut.from_player(player)


@router.get("/catalog/technologies")
def get_technologies_catalog(
    player: Annotated[Player, Depends(get_settled_player)],
) -> TechnologyCatalogListOut:
    """Get the catalog of all technologies available for research for this player."""
    return TechnologyCatalogListOut.from_player(player)
