"""Workshop's fuel market (#1009, #992 §7): what fuel costs each season, and how much a player buys.

Fuel is priced and bought once per Trading period. Each fuel has a catalog price, and its actual price
changes every season in two ways:

- a small random step, from the Run's seed, that also drifts back toward the catalog price, so prices
  wander but never far;
- a price shock, a large move the moderator picks (#1012). It lands in full for one season and then eases
  back, closing half of what is left each season.

When the moderator turns on manual procurement, a player buys each fuel their operating facilities burn in
the price-setting window, next to their prices. The quantity starts at a default: the first time, enough
to run every facility burning the fuel at full output for the whole season (its **season need**), and after
that, what the player bought last time. A player's stock of a fuel may not go above
:data:`STOCKPILE_SEASONS` times its season need, so an order is capped to fit. Unused fuel carries over.

Fuel is paid for when the Trading period is settled, at that season's price. With automatic procurement,
players pay for what their facilities burned, less what their stock covered.

Quantities are in kg and prices per kg. Every value here is a placeholder until the game-balance pass
(#1145).
"""

from __future__ import annotations

import math
import random
from collections.abc import Iterable, Mapping
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from energetica.workshop.demand_block import DAYS_PER_YEAR
from energetica.workshop.facilities import CATALOG, FacilityId, Fuel
from energetica.workshop.fleet import OwnedFacility, is_operating
from energetica.workshop.seasons import SEASONS

#: Fuel burned per MWh generated, in kg, for every facility that burns fuel. Copied from the persistent
#: world, except the modern coal plant, which it does not have, and the combined cycle, which burns only gas
#: here and so gets the coal it would burn there as gas.
FUEL_USE: dict[FacilityId, float] = {
    FacilityId.COAL_BURNER: 640.0,
    FacilityId.MODERN_COAL_PLANT: 500.0,
    FacilityId.GAS_BURNER: 353.0,
    FacilityId.COMBINED_CYCLE: 260.0,
    FacilityId.NUCLEAR_REACTOR: 0.044,
    FacilityId.NUCLEAR_REACTOR_GEN4: 0.000_57,
}

#: Each fuel's name, as players read it.
FUEL_NAMES: dict[Fuel, str] = {Fuel.COAL: "Coal", Fuel.GAS: "Gas", Fuel.URANIUM: "Uranium"}

#: Each fuel's price per kg before any seasonal move or shock. The persistent world has no fixed fuel prices,
#: since players trade fuel there, so these are invented: about half of what the facilities burning the fuel
#: sell their power for by default.
CATALOG_FUEL_PRICES: dict[Fuel, float] = {
    Fuel.COAL: 0.45,
    Fuel.GAS: 0.7,
    Fuel.URANIUM: 1_000.0,
}

#: The most a season's random step moves a price, as a share of its catalog price.
MAX_STEP = 0.08
#: The share of its distance from the catalog price that a price keeps each season, before its random step.
REVERSION = 0.5
#: The share of a shock that is left the season after. Half eases off each season.
SHOCK_EASING = 0.5
#: How close to no shock a shock has to ease before it is gone.
SHOCK_GONE = 0.01

#: How many seasons at full output a player's stock of a fuel may hold.
STOCKPILE_SEASONS = 3

FuelProcurement = Literal["automatic", "manual"]
"""How players get fuel: billed for what they burned, or buying it themselves in each price-setting window."""

_KG_PER_TONNE = 1_000

_SEASON_HOURS = DAYS_PER_YEAR // len(SEASONS) * 24


class FuelPrice(BaseModel):
    """A fuel's price in one Trading period."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    fuel: Fuel
    drift: float = Field(description="The seasonal moves so far, as a factor of the catalog price")
    shock: float = Field(description="The shock still in effect, as a factor. 1 if there is none")
    shocked: bool = Field(description="Whether a shock landed this season")
    price: float = Field(description="The price per kg")
    previous_price: float | None = Field(description="Last season's price per kg, or null in the first season")

    @property
    def change(self) -> float | None:
        """The change since last season, as a share of last season's price, or None in the first season."""
        if self.previous_price is None:
            return None
        return self.price / self.previous_price - 1


class FuelPurchase(BaseModel):
    """Fuel a player paid for in one Trading period: what they bought, or under automatic procurement, what their
    facilities burned beyond their stock.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    fuel: Fuel
    quantity: float = Field(description="In kg")
    price: float = Field(description="Per kg: the season's price")

    @property
    def cost(self) -> float:
        """What it cost."""
        return self.quantity * self.price


def next_fuel_price(
    fuel: Fuel, previous: FuelPrice | None, *, seed: int, period_index: int, shock: float | None = None
) -> FuelPrice:
    """``fuel``'s price in the Trading period after ``previous``, or in the first one if ``previous`` is None.

    ``period_index`` counts the session's Trading periods from 0, and with ``seed`` picks the random step, so
    the same Run always gets the same prices. ``shock``, if given, is a new shock landing this season, as a
    factor such as 1.65 for +65%. It replaces any shock still easing off.
    """
    if shock is not None and shock <= 0:
        raise ValueError(f"a shock must keep the price positive, not multiply it by {shock}")
    step = random.Random(f"{seed}:{fuel}:{period_index}").uniform(-MAX_STEP, MAX_STEP)
    drift_before = previous.drift if previous is not None else 1.0
    drift = 1 + (drift_before - 1) * REVERSION + step
    if shock is None:
        eased = 1 + ((previous.shock if previous is not None else 1.0) - 1) * SHOCK_EASING
        shock = 1.0 if abs(eased - 1) < SHOCK_GONE else eased
        shocked = False
    else:
        shocked = True
    return FuelPrice(
        fuel=fuel,
        drift=drift,
        shock=shock,
        shocked=shocked,
        price=CATALOG_FUEL_PRICES[fuel] * drift * shock,
        previous_price=previous.price if previous is not None else None,
    )


def _operating(fleet: Iterable[OwnedFacility], current_round: int) -> list[OwnedFacility]:
    return [owned for owned in fleet if is_operating(owned, current_round=current_round)]


def burned_fuels(fleet: Iterable[OwnedFacility], *, current_round: int) -> set[Fuel]:
    """The fuels the facilities of ``fleet`` operating in ``current_round`` burn."""
    return {
        fuel for owned in _operating(fleet, current_round) if (fuel := CATALOG[owned.facility].fuel_type) is not None
    }


def season_need(fuel: Fuel, fleet: Iterable[OwnedFacility], *, current_round: int) -> float:
    """The ``fuel``, in kg, that the facilities of ``fleet`` operating in ``current_round`` burn running at full
    output for a whole season.
    """
    return sum(
        CATALOG[owned.facility].base_power_generation / 1_000_000 * _SEASON_HOURS * FUEL_USE[owned.facility]
        for owned in _operating(fleet, current_round)
        if CATALOG[owned.facility].fuel_type == fuel
    )


def capped_order(quantity: float, *, stock: float, need: float) -> float:
    """``quantity`` cut down so that ``stock`` plus it stays within :data:`STOCKPILE_SEASONS` times ``need``."""
    return min(quantity, max(0.0, STOCKPILE_SEASONS * need - stock))


def default_orders(
    previous: Mapping[Fuel, float], *, needs: Mapping[Fuel, float], stocks: Mapping[Fuel, float]
) -> dict[Fuel, float]:
    """The quantity of each fuel in ``needs`` a price-setting window starts with: the ``previous`` quantity, or the
    season need for a fuel that has none, capped by the stockpile limit. A fuel not in ``needs`` is dropped.

    A season need of coal or gas is rounded up to whole tonnes, so the player reads a round number. Uranium is
    bought by the kg, so its need is kept as it is.
    """
    return {
        fuel: capped_order(
            previous.get(fuel, need if fuel == Fuel.URANIUM else float(math.ceil(need / _KG_PER_TONNE) * _KG_PER_TONNE)),
            stock=stocks.get(fuel, 0.0),
            need=need,
        )
        for fuel, need in needs.items()
    }
