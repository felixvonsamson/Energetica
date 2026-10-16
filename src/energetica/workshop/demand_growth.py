"""Workshop's natural demand growth: how much the demand block's amplitude grows from one Round to the next (#1226).

Players earn more each Round than they started it with, so demand grows too, to keep the game a challenge. It grows
faster for a room that plays well. The factor for Round r+1 follows how the room did in Round r, measured by its
average operating profit per player in that Round:

    performance = clamp(average Round operating profit per player / TARGET_ROUND_PROFIT,
                        MIN_PERFORMANCE, MAX_PERFORMANCE)
    growth      = 1 + BASE_GROWTH x performance

Each Round's amplitude is the one before times its factor, so demand grows exponentially. The demand-shift events
multiply on top of it.

Pure: no players, no state, no I/O. The session works out each factor when a Recap opens and keeps it.
"""

from __future__ import annotations

import math
from collections.abc import Mapping

#: The growth of a room right on target. These four constants are placeholders until the balance pass (#1227).
BASE_GROWTH = 0.3
#: The average operating profit per player in a Round that counts as being on target.
TARGET_ROUND_PROFIT = 3e6
#: The least a room's performance counts for, so a room that earns little, or loses money, still grows a little.
MIN_PERFORMANCE = 0.3
#: The most a room's performance counts for.
MAX_PERFORMANCE = 2.0


def growth_factor(average_profit: float) -> float:
    """The factor next Round's amplitude grows by, for a room that made ``average_profit`` per player this Round."""
    performance = min(max(average_profit / TARGET_ROUND_PROFIT, MIN_PERFORMANCE), MAX_PERFORMANCE)
    return 1 + BASE_GROWTH * performance


def growth_through(growth: Mapping[int, float], round_number: int) -> float:
    """How much demand has grown by Round ``round_number`` since Round 1, from each Round's factor in ``growth``.

    A Round with no factor has not grown.
    """
    return math.prod(factor for grown_round, factor in growth.items() if grown_round <= round_number)
