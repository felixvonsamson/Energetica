"""Utility functions for workers."""

from energetica.database.player import Player
from energetica.enums import ProjectStatus, WorkerType


def deploy_available_workers(player: Player, worker_type: WorkerType, *, start_now: bool = False) -> None:
    """
    Ensure all free workers for of type `worker_type` are in use, if possible.

    Workers are deployed only on projects that are waiting - paused projects are never unpaused, except by the player.
    The list of ongoing projects may be reordered to satisfy the priority list invariants.
    start_now: If True, this action is considered to take place at the start of this ongoing tick rather than waiting
    until the start of the next tick. This is used when a construction is finished and the worker starts a new one and
    when a new worker is available and starts a new construction.
    """
    available_workers = player.available_workers(worker_type)
    priority_list = player.projects_by_priority[worker_type]

    if available_workers <= 0:
        return

    for priority_index, construction in enumerate(priority_list):
        if construction.status == ProjectStatus.PAUSED:
            # Only the player can unpause a paused construction
            return
        if construction.is_ongoing:
            continue
        construction.recompute_prerequisites_and_level()  # force recompute
        if construction.prerequisites:
            continue
        construction.set_ongoing(start_now=start_now)
        available_workers -= 1
        insertion_index = None
        for insertion_index_candidate, possibly_paused_construction in enumerate(priority_list[:priority_index]):
            if not possibly_paused_construction.is_ongoing:
                insertion_index = insertion_index_candidate
                break
        if insertion_index is not None:
            priority_list.remove(construction)
            priority_list.insert(insertion_index, construction)
        if available_workers <= 0:
            return
