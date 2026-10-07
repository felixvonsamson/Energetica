"""The national electricity demand curve, as the shape that demand follows over a day and a year.

The curve is RTE (French grid operator) national consumption, normalised so each array averages
about 1. It ships as package data in ``sim/data/`` (see ``package-data`` in pyproject.toml), so it
is addressed relative to this file and resolves wherever the package is installed. It lives in
``sim`` rather than in a mode's package because both the persistent world and Workshop shape their
demand with it (#997).
"""

from __future__ import annotations

import pickle
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Sequence

_DATA_DIR = Path(__file__).parent / "data"


@dataclass(frozen=True, slots=True)
class DemandCurve:
    """The two shape arrays that :func:`~energetica.sim.demand_shape.demand_shape_factor` combines."""

    intraday: Sequence[float]
    seasonal: Sequence[float]


@cache
def national_demand_curve() -> DemandCurve:
    """Load the national demand curve. Read from disk once, then shared."""
    with open(_DATA_DIR / "national_demand_intraday.pck", "rb") as file:
        # length 1440: one sample per minute of the day
        intraday = pickle.load(file)
    with open(_DATA_DIR / "national_demand_seasonal.pck", "rb") as file:
        # length 365: one sample per real calendar day of the year
        seasonal = pickle.load(file)
    return DemandCurve(intraday, seasonal)
