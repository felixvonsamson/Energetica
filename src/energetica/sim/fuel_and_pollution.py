"""Fuel burned and pollution emitted by a generating facility in one tick.

Pure and player-agnostic, like the rest of :mod:`energetica.sim`. A facility's fuel use and pollution are
given for running at full power, and both scale linearly with the output it actually produced. The caller
says which tick length those figures are for; scaling a representative day up to a season is also the
caller's job.
"""

from __future__ import annotations


def scale_to_output(amount_at_full_power: float, output: float, power: float) -> float:
    """Return ``amount_at_full_power`` scaled to the share of ``power`` that ``output`` represents."""
    return amount_at_full_power * output / power


def fuel_burned(burn_at_full_power: float, output: float, power: float) -> float:
    """Return the amount of one fuel burned by producing ``output`` MW from a facility of ``power`` MW."""
    return scale_to_output(burn_at_full_power, output, power)


def emissions_produced(pollution_at_full_power: float, output: float, power: float) -> float:
    """Return the pollution emitted by producing ``output`` MW from a facility of ``power`` MW."""
    return scale_to_output(pollution_at_full_power, output, power)
