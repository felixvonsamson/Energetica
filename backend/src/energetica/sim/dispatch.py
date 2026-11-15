"""How much a controllable or storage facility can output in one tick.

Pure and player-agnostic, like the rest of :mod:`energetica.sim`. A facility's output is bounded by how
fast it can ramp from its previous output, by its power, and by what it can draw on: fuel for a
fuel-burning facility, stored energy (or free room, when charging) for a storage facility. The caller
gathers those inputs from its own state, calls the functions here, and keeps any bookkeeping of its own,
such as reserving the fuel that the returned output will burn.

Power is in MW and energy in MWh, and ``seconds_per_tick`` is the length of the tick being computed.
"""

from __future__ import annotations

import math
from collections.abc import Iterable


def ramping_speed(power: float, ramping_time: float, seconds_per_tick: float) -> float:
    """Return how much a facility's output can change in one tick, in MW."""
    return power / ramping_time * seconds_per_tick


def fuel_power_limit(power: float, fuels: Iterable[tuple[float, float]]) -> float:
    """Return the highest output the available fuel supports, in MW.

    ``fuels`` holds one ``(burn_per_tick_at_full_power, available)`` pair per fuel the facility burns, in
    the same unit. A facility that burns several fuels is limited by the scarcest one.
    """
    limit = math.inf
    for burn_at_full_power, available in fuels:
        limit = min(available / burn_at_full_power * power, limit)
    return limit


def storage_power_limit(energy: float, efficiency: float, ramping_speed: float, seconds_per_tick: float) -> float:
    """Return the highest output a storage facility can hold for one tick, in MW.

    ``energy`` is the stored energy when discharging, or the free room when charging. Both are cut down by
    the one-way efficiency, and the result also leaves room to ramp down before the energy runs out.
    """
    energy_capacity = max(0.0, energy) * 3600 / seconds_per_tick * (efficiency**0.5)
    return max(0.0, min(energy_capacity, (2 * energy_capacity * ramping_speed) ** 0.5))


def max_output(resource_limit: float, previous_output: float, ramping_speed: float, power: float) -> float:
    """Return the highest output for this tick: the tightest of the resource limit, ramping up, and power."""
    return min(resource_limit, previous_output + ramping_speed, power)


def min_output(resource_limit: float, previous_output: float, ramping_speed: float, power: float) -> float:
    """Return the lowest output for this tick: what the facility cannot ramp down below, never negative."""
    return max(0.0, min(resource_limit, previous_output - ramping_speed, power))
