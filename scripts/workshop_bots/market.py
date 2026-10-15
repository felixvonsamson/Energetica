"""What a bot sees when it decides: its own state, and the public record of the Trading periods settled so far.

Bots read only what a player can read through the API. The period records are public: everyone can see each
settlement point's price, the demand served, and every player's output per facility type.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from typing import Any

from api import Api, ApiError

SEASONS = ("spring", "summer", "autumn", "winter")

# Restated from the backend's workshop/fuel.py and workshop/facilities.py, so the bots stay plain API clients.
FUEL_USE = {  # kg per MWh
    "coal_burner": 640.0,
    "modern_coal_plant": 500.0,
    "gas_burner": 353.0,
    "combined_cycle": 260.0,
    "nuclear_reactor": 0.044,
    "nuclear_reactor_gen4": 0.000_57,
}
FUEL_OF = {
    "coal_burner": "coal",
    "modern_coal_plant": "coal",
    "gas_burner": "gas",
    "combined_cycle": "gas",
    "nuclear_reactor": "uranium",
    "nuclear_reactor_gen4": "uranium",
}
CATALOG_FUEL_PRICE = {"coal": 0.45, "gas": 0.7, "uranium": 1000.0}
POWER = {  # W, to size purchases when a facility is not for sale this Round
    "onshore_wind_turbine": 11e6,
    "offshore_wind_turbine": 130e6,
    "coal_burner": 21e6,
    "modern_coal_plant": 60e6,
    "gas_burner": 11e6,
    "combined_cycle": 54e6,
    "small_water_dam": 14e6,
    "large_water_dam": 210e6,
    "nuclear_reactor": 167e6,
    "nuclear_reactor_gen4": 335e6,
    "pv_solar": 59e6,
    "multi_layer_pv": 95e6,
    "csp_solar": 38e6,
    "lithium_ion_batteries": 86e6,
    "solid_state_batteries": 107e6,
    "hydrogen_storage": 90e6,
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

    def power(self, facility: str) -> float:
        return self.offered[facility]["base_power_generation"] if facility in self.offered else POWER[facility]

    def capacity(self, kinds: frozenset[str]) -> float:
        """W of operating capacity among the facility types in ``kinds``."""
        return sum(self.power(facility) * count for facility, count in self.operating().items() if facility in kinds)

    def fuel_price(self, fuel: str) -> float:
        line = self.fuel.get(fuel)
        return line["price"] if line else CATALOG_FUEL_PRICE[fuel]

    def marginal_cost(self, facility: str) -> float:
        """Fuel cost per MWh, or 0 for a facility that burns none."""
        if facility not in FUEL_USE:
            return 0.0
        return FUEL_USE[facility] * self.fuel_price(FUEL_OF[facility])

    def peak_must_serve(self) -> float:
        """The highest must-serve demand seen so far in W, or a guess from the player count before any trading."""
        seen = [view.peak_must_serve for view in self.history if view.peak_must_serve > 0]
        # Before any trading: 50 MW per player, 80% of it must-serve, peaking about 45% over the average.
        return max(seen) if seen else 50e6 * self.player_count * 0.8 * 1.45

    def fair_share(self) -> float:
        """One player's share of the peak must-serve demand, in W."""
        return self.peak_must_serve() / self.player_count

    def burn_share(self, fuel: str) -> float:
        """The share of its full-output need of ``fuel`` the bot burned in the last period, from its public output."""
        if self.last is None:
            return 1.0
        used = capacity = 0.0
        for facility, count in self.operating().items():
            if FUEL_OF.get(facility) == fuel:
                used += self.last.output(self.me, facility)
                capacity += self.power(facility) * count
        # Someone who sold nothing still expects to run a little, or they would never buy fuel again.
        return max(0.25, used / capacity) if capacity else 1.0

    def blackout_last_round(self) -> bool:
        return any(view.blackout and view.round == self.round - 1 for view in self.history)

    def forecast_seasons(self) -> set[str]:
        """This Round's seasons that the Recap before it warned about."""
        year_ahead = (self.recap or {}).get("year_ahead") or {}
        return {forecast["season"] for forecast in year_ahead.get("forecasts", [])}
