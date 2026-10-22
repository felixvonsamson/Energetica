"""What a bot sees when it decides: its own state, and the public record of the Trading periods settled so far.

Bots read only what a player can read through the API. The period records are public: everyone can see each
settlement point's price, the demand served, and every player's output per facility type.
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from typing import Any

from api import Api, ApiError

SEASONS = ("spring", "summer", "autumn", "winter")

# Restated from the backend's workshop/fuel.py and workshop/facilities.py, so the bots stay plain API clients.
FUEL_USE = {  # kg per MWh
    "coal_burner": 400.0,
    "modern_coal_plant": 300.0,
    "gas_burner": 225.0,
    "combined_cycle": 150.0,
    "nuclear_reactor": 0.04,
    "nuclear_reactor_gen4": 0.0005,
}
FUEL_OF = {
    "coal_burner": "coal",
    "modern_coal_plant": "coal",
    "gas_burner": "gas",
    "combined_cycle": "gas",
    "nuclear_reactor": "uranium",
    "nuclear_reactor_gen4": "uranium",
}
CATALOG_FUEL_PRICE = {"coal": 0.1, "gas": 0.25, "uranium": 250.0}
POLLUTION = {  # kg of CO₂ per MWh
    "coal_burner": 1200.0,
    "modern_coal_plant": 900.0,
    "gas_burner": 619.0,
    "combined_cycle": 413.0,
    "nuclear_reactor": 2.0,
    "nuclear_reactor_gen4": 3.0,
}
CARBON_TAX_RATE = 0.025  # per kg of CO₂, once the vote passes
POWER = {  # W, to size purchases when a facility is not for sale this Round
    "onshore_wind_turbine": 45e6,
    "offshore_wind_turbine": 100e6,
    "coal_burner": 35e6,
    "modern_coal_plant": 75e6,
    "gas_burner": 38e6,
    "combined_cycle": 60e6,
    "small_water_dam": 45e6,
    "large_water_dam": 120e6,
    "nuclear_reactor": 100e6,
    "nuclear_reactor_gen4": 170e6,
    "pv_solar": 95e6,
    "multi_layer_pv": 140e6,
    "csp_solar": 150e6,
    "lithium_ion_batteries": 30e6,
    "solid_state_batteries": 50e6,
    "hydrogen_storage": 20e6,
    "pumped_hydro": 60e6,
}
FIRM = frozenset(FUEL_OF)
RENEWABLE = frozenset(
    {
        "onshore_wind_turbine",
        "offshore_wind_turbine",
        "small_water_dam",
        "large_water_dam",
        "pv_solar",
        "multi_layer_pv",
        "csp_solar",
    }
)
STORAGE = frozenset({"lithium_ion_batteries", "solid_state_batteries", "hydrogen_storage", "pumped_hydro"})


def _priced(prices: list[float | None], values: list[float]) -> list[tuple[float, float]]:
    """Each point's (price, value), leaving out points without a finite price: those after a blackout."""
    return [(price, value) for price, value in zip(prices, values) if price is not None and price < 1e9]


@dataclass
class PeriodView:
    """One settled Trading period, read from the first week of its public record."""

    round: int
    season: str
    prices: list[float | None]
    must_serve: list[float]  # W served to the must-serve tier at each point
    generation: dict[int, dict[str, list[float]]]  # player id -> facility -> W at each point
    blackout: bool

    @property
    def finite_prices(self) -> list[float]:
        return [price for price, _ in _priced(self.prices, [0.0] * len(self.prices))]

    @property
    def mean_price(self) -> float:
        return statistics.fmean(self.finite_prices) if self.finite_prices else 0.0

    @property
    def price_spread(self) -> float:
        prices = self.finite_prices
        return max(prices) - min(prices) if prices else 0.0

    @property
    def peak_must_serve(self) -> float:
        return max(self.must_serve, default=0.0)

    def output(self, player_id: int, facility: str | None = None) -> float:
        """The player's average output in W, of one facility type or all of them."""
        series = self.generation.get(player_id, {})
        points = len(self.prices) or 1
        return sum(sum(values) for name, values in series.items() if facility in (None, name)) / points

    def income(self, player_id: int, cost_per_mwh: dict[str, float] | None = None) -> float:
        """Price times output over the week, less fuel cost when ``cost_per_mwh`` is given. A rough proxy."""
        costs = cost_per_mwh or {}
        return sum(
            (price - costs.get(facility, 0.0)) * watts
            for facility, values in self.generation.get(player_id, {}).items()
            for price, watts in _priced(self.prices, values)
        )

    def income_by_facility(self) -> dict[str, float]:
        """Price times output over the week for each facility type, all players together."""
        totals: dict[str, float] = {}
        for series in self.generation.values():
            for facility, values in series.items():
                earned = sum(price * watts for price, watts in _priced(self.prices, values))
                totals[facility] = totals.get(facility, 0.0) + earned
        return totals


def read_period(api: Api, round_number: int, season: str) -> PeriodView | None:
    """The period's view, or None if it has not been settled."""
    try:
        period = api.get(f"/periods/{round_number}/{season}")
        week = api.get(f"/periods/{round_number}/{season}/weeks/0")
    except ApiError:
        return None
    generation: dict[int, dict[str, list[float]]] = {}
    for pool in week["pools"]:
        if "generation" in pool:
            generation.setdefault(pool["player_id"], {})[pool["facility"]] = pool["generation"]
    return PeriodView(
        round=round_number,
        season=season,
        prices=week["price"],
        must_serve=next((tier["served"] for tier in week["tiers"] if tier["tier"] == "must_serve"), []),
        generation=generation,
        blackout=period.get("blackout_at") is not None,
    )


@dataclass
class Ctx:
    """Everything a strategy sees when it decides."""

    me: int
    session: dict[str, Any]
    round: int
    season: str | None
    money: float
    fleet: list[dict[str, Any]]
    offered: dict[str, dict[str, Any]]  # facility id -> catalog entry with this Round's "price", for sale only
    fuel: dict[str, dict[str, Any]]  # fuel -> line from GET /fuel
    procurement: str
    history: list[PeriodView]  # every settled period, oldest first
    recap: dict[str, Any] | None  # the Recap before this Round
    loan: dict[str, Any]  # GET /loan: its terms, and whether it can be taken now
    memory: dict[str, Any] = field(default_factory=dict)  # the bot's own notes, kept across the session

    @property
    def last(self) -> PeriodView | None:
        return self.history[-1] if self.history else None

    @property
    def player_count(self) -> int:
        return len(self.session["players"])

    @property
    def is_last_round(self) -> bool:
        return self.round == self.session["round_count"]

    def operating(self) -> dict[str, int]:
        """How many of each facility type works this Round."""
        counts: dict[str, int] = {}
        for owned in self.fleet:
            if not owned["under_construction"] and owned["rounds_left"] > 0:
                counts[owned["facility"]] = counts.get(owned["facility"], 0) + 1
        return counts

    def room_for(self, facility: str) -> float:
        """How many more of ``facility`` the bot may own under the facility's limit, such as 3 of each dam (#1223).
        Infinite if it has no limit.
        """
        limit = self.offered[facility].get("max_owned") if facility in self.offered else None
        if limit is None:
            return math.inf
        return max(0, limit - sum(1 for owned in self.fleet if owned["facility"] == facility))

    def power(self, facility: str) -> float:
        return self.offered[facility]["base_power_generation"] if facility in self.offered else POWER[facility]

    def capacity(self, kinds: frozenset[str]) -> float:
        """W of operating capacity among the facility types in ``kinds``."""
        return sum(self.power(facility) * count for facility, count in self.operating().items() if facility in kinds)

    def fuel_price(self, fuel: str) -> float:
        line = self.fuel.get(fuel)
        return line["price"] if line else CATALOG_FUEL_PRICE[fuel]

    @property
    def carbon_tax_on(self) -> bool:
        return self.session.get("carbon_tax_since") is not None

    def marginal_cost(self, facility: str) -> float:
        """Fuel cost per MWh, plus the carbon tax once it is on, or 0 for a facility that burns none."""
        if facility not in FUEL_USE:
            return 0.0
        tax = POLLUTION[facility] * CARBON_TAX_RATE if self.carbon_tax_on else 0.0
        return FUEL_USE[facility] * self.fuel_price(FUEL_OF[facility]) + tax

    def peak_must_serve(self) -> float:
        """The highest must-serve demand seen so far in W, or a guess from the player count before any trading."""
        seen = [view.peak_must_serve for view in self.history if view.peak_must_serve > 0]
        # Before any trading: 80 MW per player, all of it must-serve, peaking about 45% over the average.
        return max(seen) if seen else 80e6 * self.player_count * 1.45

    def growth(self) -> float:
        """How much the Recap says peak demand moves into this Round, with demand growth and events. 1 in Round 1."""
        outlook = ((self.recap or {}).get("year_ahead") or {}).get("demand") or {}
        if not outlook.get("peak_this_round"):
            return 1.0
        return outlook["peak_next_round"] / outlook["peak_this_round"]

    def fair_share(self) -> float:
        """One player's share of this Round's expected peak must-serve demand, in W."""
        return self.peak_must_serve() * self.growth() / self.player_count

    def burn_share(self, fuel: str) -> float:
        """The share of its full-output need of ``fuel`` the bot burned in the last full period, from its public
        output. A period cut short by a blackout says little, so it is skipped.
        """
        last = next((view for view in reversed(self.history) if not view.blackout), None)
        if last is None:
            return 1.0
        used = capacity = 0.0
        for facility in {owned["facility"] for owned in self.fleet if FUEL_OF.get(owned["facility"]) == fuel}:
            used += last.output(self.me, facility)
        for owned in self.fleet:
            # Only what was already working then: a reactor works from the Round after it is built.
            lag = 1 if owned["facility"].startswith("nuclear") else 0
            if FUEL_OF.get(owned["facility"]) == fuel and owned["built_round"] + lag <= last.round:
                capacity += self.power(owned["facility"])
        # Someone who sold little still expects to run some, or they would soon stop buying fuel.
        return max(0.4, used / capacity) if capacity else 1.0

    @property
    def full_season(self) -> bool:
        return (self.session.get("round_format") or {}).get("trading_format") == "full_season"

    def fuel_margin(self, share: float) -> float:
        """``share`` with a safety margin in a full-season Round, where fuel cannot be topped up for 13 weeks."""
        return max(share * 1.25, 0.6) if self.full_season else share

    def storage_prices(self, facility: str, buy_quantile: float, sell_quantile: float) -> tuple[float, float]:
        """Buy and sell prices for a storage facility at two quantiles of the last period's prices. The sell price is
        at least what makes up for the energy lost in storage, so a flat market leaves the storage idle.
        """
        prices = sorted(self.last.finite_prices) if self.last else []
        if not prices:
            return 60.0, 150.0
        buy = prices[int(buy_quantile * (len(prices) - 1))]
        sell = prices[int(sell_quantile * (len(prices) - 1))]
        efficiency = self.offered.get(facility, {}).get("base_efficiency") or 0.7
        # One above the quantile, so the bid is not the marginal one at a price many points clear at.
        return round(buy) + 1, round(max(sell, (buy + 1) / efficiency + 1))

    def blackout_last_round(self) -> bool:
        return any(view.blackout and view.round == self.round - 1 for view in self.history)

    def forecast_seasons(self) -> set[str]:
        """This Round's seasons that the Recap before it warned about."""
        year_ahead = (self.recap or {}).get("year_ahead") or {}
        return {forecast["season"] for forecast in year_ahead.get("forecasts", [])}
