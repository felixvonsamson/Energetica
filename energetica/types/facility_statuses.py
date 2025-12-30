"""Status type definitions for power facilities."""

from typing import Literal

RenewableStatus = Literal[
    "high_wind_cutoff",  # wind facilities only
]
"""
Status for renewable facilities.

- high_wind_cutoff: Wind facility exceeding safe operating wind speed (cut-out speed)
"""


ProductionStatus = Literal[
    "not_producing",
    "out_of_fuel",
    "no_charge",
    "fuel_constrained",
    "ramping_down",
    "producing_steady",
    "ramping_up",
    "at_capacity",
]
"""
Status for power production facilities (controllable facilities and storage discharge).

- not_producing: Facility is not generating any power
- out_of_fuel: Controllable facility has run out of fuel
- no_charge: Storage facility has no stored energy to discharge
- fuel_constrained: Facility running at max capacity allowed by limited fuel supply (ongoing)
- ramping_down: Only forced minimum generation sold (market price below facility's ask price)
- producing_steady: Facility is marginal, setting market price (market price equals facility's ask price)
- ramping_up: All available capacity sold (market price above facility's ask price)
- at_capacity: Producing at maximum capacity
"""

ConsumptionStatus = Literal[
    "not_satisfied",
    "partially_satisfied",
    "fully_satisfied",
    "no_demand",
]
"""
Status for power consumption facilities (demand and storage charge).

- not_satisfied: No power allocated to this demand
- partially_satisfied: Some power allocated but less than requested
- fully_satisfied: Full demand satisfied
- no_demand: No demand for this facility (demand is zero)
"""
