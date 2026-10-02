"""System-managed Workshop Run setup (#992 §11, #993).

Placing an account into a Workshop Run is automatic. There is no player-initiated "join a network"
action the way free play has (``join_network``), and no tile-pick settle flow either
(``initialize_player``), because Workshop has no map. :func:`open_workshop_run` creates the Run's
one shared Network, and :meth:`~energetica.workshop.network.WorkshopNetwork.join` places an account
into it.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from energetica.identity.instance_config import WorkshopRun
from energetica.workshop.network import WorkshopNetwork

if TYPE_CHECKING:
    from energetica.identity.instance_config import InstanceConfig


class NotAWorkshopRunError(RuntimeError):
    """Raised when Workshop state is opened for an instance whose Run mode is not ``workshop``."""


def open_workshop_run(config: InstanceConfig) -> WorkshopNetwork:
    """Create the shared Network for the Workshop Run that ``config`` describes.

    This is the gate for Workshop behaviour: it checks the Run mode tag and raises
    :class:`NotAWorkshopRunError` for any other mode. Call it once per Run and keep the result.
    Holding it is the job of the Run's state, which the state-machine ticket (#994) introduces.
    """
    if not isinstance(config.run, WorkshopRun):
        raise NotAWorkshopRunError(f"instance {config.name!r} is a {config.run.mode} Run, not a Workshop Run")
    return WorkshopNetwork()
