"""The operating (O&M) cost a facility owes for a period.

Pure and player-agnostic, like the rest of :mod:`energetica.sim`. Every facility has a maximum operating
cost for a period. Part of it is fixed and owed however little the facility runs, and the rest scales with
how much it ran. The caller chooses the period: the persistent world passes the cost per tick, and a mode
that states its costs per round passes the cost per round.

The fixed share is a property of each facility, so it lives in each mode's facility configuration, not
here. The persistent world keeps it as ``O&M_fixed_share`` in :mod:`energetica.config.assets`.
"""

from __future__ import annotations


def operating_cost(maximum_cost: float, fixed_share: float, utilisation: float) -> float:
    """Return the cost owed: the fixed share plus the rest scaled by ``utilisation`` (0 to 1)."""
    return maximum_cost * (fixed_share + (1 - fixed_share) * utilisation)
