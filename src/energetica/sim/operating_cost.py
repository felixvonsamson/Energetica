"""The operating (O&M) cost a facility owes for a period.

Pure and player-agnostic, like the rest of :mod:`energetica.sim`. Every facility has a maximum operating
cost for a period. Part of it is fixed and owed however little the facility runs, and the rest scales with
how much it ran. The caller chooses the period: the persistent world passes the cost per tick, and a mode
that states its costs per round passes the cost per round.
"""

from __future__ import annotations

#: Renewable and storage facilities do not save anything by running less, so all of their cost is fixed.
FIXED_SHARE_ALWAYS_OWED = 1.0
#: The fixed share of nuclear reactors, which are costly to run below capacity.
FIXED_SHARE_NUCLEAR = 0.5
#: The fixed share of every other controllable facility and of extraction facilities.
FIXED_SHARE_DEFAULT = 0.2

NUCLEAR_FACILITIES = frozenset({"nuclear_reactor", "nuclear_reactor_gen4"})


def fixed_cost_share(facility: str, scales_with_use: bool) -> float:
    """Return the share of ``facility``'s maximum operating cost that is owed however little it runs.

    ``scales_with_use`` is whether the facility's cost depends on how much it runs: true for controllable
    and extraction facilities, false for renewable and storage facilities.
    """
    if not scales_with_use:
        return FIXED_SHARE_ALWAYS_OWED
    if facility in NUCLEAR_FACILITIES:
        return FIXED_SHARE_NUCLEAR
    return FIXED_SHARE_DEFAULT


def operating_cost(maximum_cost: float, fixed_share: float, utilisation: float) -> float:
    """Return the cost owed: the fixed share plus the rest scaled by ``utilisation`` (0 to 1)."""
    return maximum_cost * (fixed_share + (1 - fixed_share) * utilisation)
