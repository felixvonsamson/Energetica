"""What a bot sees when it decides: its own state, and the public record of the Trading periods settled so far.

Bots read only what a player can read through the API. The period records are public: everyone can see each
settlement point's price, the demand served, and every player's output per facility type. The catalog's fixed values,
such as a facility's power or the fuel it burns, come from the backend's own modules, which the facility cards show.
"""

from __future__ import annotations

import math
import statistics
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

from api import Api, ApiError
from energetica.workshop.facilities import CATALOG, FacilityCategory, FacilityId, Fuel
from energetica.workshop.fuel import CATALOG_FUEL_PRICES, FUEL_USE, FuelProcurement
from energetica.workshop.recap import WorkshopRecap
from energetica.workshop.schemas import (
    WorkshopFacilityOut,
    WorkshopFuelLineOut,
    WorkshopLoanOut,
    WorkshopOwnedFacilityOut,
    WorkshopSessionOut,
)
from energetica.workshop.seasons import WEEK_DAYS, Season
from energetica.workshop.votes import CARBON_TAX_RATE

FIRM = frozenset(facility.id for facility in CATALOG.values() if facility.fuel_type is not None)
RENEWABLE = frozenset(
    facility.id
    for facility in CATALOG.values()
    if facility.category in {FacilityCategory.WIND, FacilityCategory.HYDRO, FacilityCategory.PV, FacilityCategory.CSP}
)
STORAGE = frozenset(facility.id for facility in CATALOG.values() if facility.base_storage_capacity is not None)


def _priced(prices: Sequence[float | None], values: Sequence[float]) -> list[tuple[float, float]]:
    """Each point's (price, value), leaving out points without a finite price: those after a blackout."""
    return [(price, value) for price, value in zip(prices, values) if price is not None and price < 1e9]


@dataclass
class PeriodView:
    """One settled Trading period, read from the first week of its public record."""

    round: int
    season: Season
    prices: Sequence[float | None]
    must_serve: Sequence[float]  # W served to the must-serve tier at each point
    generation: dict[int, dict[FacilityId, Sequence[float]]]  # player id -> facility -> W at each point
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

    def output(self, player_id: int, facility: FacilityId | None = None) -> float:
        """The player's average output in W, of one facility type or all of them."""
        series = self.generation.get(player_id, {})
        points = len(self.prices) or 1
        return sum(sum(values) for name, values in series.items() if facility in (None, name)) / points

    def income(self, player_id: int, cost_per_mwh: dict[FacilityId, float] | None = None) -> float:
        """Price times output over the week, less fuel cost when ``cost_per_mwh`` is given. A rough proxy."""
        costs = cost_per_mwh or {}
        return sum(
            (price - costs.get(facility, 0.0)) * watts
            for facility, values in self.generation.get(player_id, {}).items()
            for price, watts in _priced(self.prices, values)
        )

    def income_by_facility(self) -> dict[FacilityId, float]:
        """Price times output over the week for each facility type, all players together."""
        totals: dict[FacilityId, float] = {}
        for series in self.generation.values():
            for facility, values in series.items():
                earned = sum(price * watts for price, watts in _priced(self.prices, values))
                totals[facility] = totals.get(facility, 0.0) + earned
        return totals


def read_period(api: Api, round_number: int, season: Season) -> PeriodView | None:
    """The period's view, or None if it has not been settled."""
    try:
        period = api.period(round_number, season)
        week = api.period_days(round_number, season, 0, min(WEEK_DAYS, len(period.days)))
    except ApiError:
        return None
    generation: dict[int, dict[FacilityId, Sequence[float]]] = {}
    for pool in week.pools:
        generation.setdefault(pool.player_id, {})[pool.facility] = pool.generation
    return PeriodView(
        round=round_number,
        season=season,
        prices=week.price,
        must_serve=next((tier.served for tier in week.tiers if tier.tier == "must_serve"), []),
        generation=generation,
        blackout=bool(period.blackouts),
    )


@dataclass
class Ctx:
    """Everything a strategy sees when it decides."""

    me: int
    session: WorkshopSessionOut
    round: int
    season: Season | None
    money: float
    fleet: list[WorkshopOwnedFacilityOut]
    offered: dict[FacilityId, WorkshopFacilityOut]  # catalog entries with this Round's price, for sale only
    fuel: dict[Fuel, WorkshopFuelLineOut]
    procurement: FuelProcurement
    history: list[PeriodView]  # every settled period, oldest first
    recap: WorkshopRecap | None  # the Recap before this Round
    loan: WorkshopLoanOut  # its terms, and whether it can be taken now
    memory: dict[str, Any] = field(default_factory=dict)  # the bot's own notes, kept across the session

    @property
    def last(self) -> PeriodView | None:
        return self.history[-1] if self.history else None

    @property
    def player_count(self) -> int:
        return len(self.session.players)

    @property
    def is_last_round(self) -> bool:
        return self.round == self.session.round_count

    def operating(self) -> dict[FacilityId, int]:
        """How many of each facility type works this Round."""
        counts: dict[FacilityId, int] = {}
        for owned in self.fleet:
            if not owned.under_construction and owned.rounds_left > 0:
                counts[owned.facility] = counts.get(owned.facility, 0) + 1
        return counts

    def room_for(self, facility: FacilityId) -> float:
        """How many more of ``facility`` the bot may own under the facility's limit, such as 3 of each dam (#1223).
        Infinite if it has no limit.
        """
        limit = self.offered[facility].max_owned if facility in self.offered else None
        if limit is None:
            return math.inf
        return max(0, limit - sum(1 for owned in self.fleet if owned.facility == facility))

    def power(self, facility: FacilityId) -> float:
        return CATALOG[facility].base_power_generation

    def capacity(self, kinds: frozenset[FacilityId]) -> float:
        """W of operating capacity among the facility types in ``kinds``."""
        return sum(self.power(facility) * count for facility, count in self.operating().items() if facility in kinds)

    def fuel_price(self, fuel: Fuel) -> float:
        line = self.fuel.get(fuel)
        return line.price if line else CATALOG_FUEL_PRICES[fuel]

    @property
    def carbon_tax_on(self) -> bool:
        return self.session.carbon_tax_since is not None

    def marginal_cost(self, facility: FacilityId) -> float:
        """Fuel cost per MWh, plus the carbon tax once it is on, or 0 for a facility that burns none."""
        fuel = CATALOG[facility].fuel_type
        if fuel is None:
            return 0.0
        tax = CATALOG[facility].base_pollution * CARBON_TAX_RATE if self.carbon_tax_on else 0.0
        return FUEL_USE[facility] * self.fuel_price(fuel) + tax

    def peak_must_serve(self) -> float:
        """The highest must-serve demand seen so far in W, or a guess from the player count before any trading."""
        seen = [view.peak_must_serve for view in self.history if view.peak_must_serve > 0]
        # Before any trading: 80 MW per player, all of it must-serve, peaking about 45% over the average.
        return max(seen) if seen else 80e6 * self.player_count * 1.45

    def growth(self) -> float:
        """How much the Recap says peak demand moves into this Round, with demand growth and events. 1 in Round 1."""
        year_ahead = self.recap.year_ahead if self.recap is not None else None
        outlook = year_ahead.demand if year_ahead is not None else None
        if outlook is None or not outlook.peak_this_round:
            return 1.0
        return outlook.peak_next_round / outlook.peak_this_round

    def fair_share(self) -> float:
        """One player's share of this Round's expected peak must-serve demand, in W."""
        return self.peak_must_serve() * self.growth() / self.player_count

    def burn_share(self, fuel: Fuel) -> float:
        """The share of its full-output need of ``fuel`` the bot burned in the last full period, from its public
        output. A period cut short by a blackout says little, so it is skipped.
        """
        last = next((view for view in reversed(self.history) if not view.blackout), None)
        if last is None:
            return 1.0
        used = capacity = 0.0
        for facility in {owned.facility for owned in self.fleet if CATALOG[owned.facility].fuel_type == fuel}:
            used += last.output(self.me, facility)
        for owned in self.fleet:
            # Only what was already working then: a reactor works from the Round after it is built.
            catalog = CATALOG[owned.facility]
            if catalog.fuel_type == fuel and owned.built_round + catalog.construction_lag_rounds <= last.round:
                capacity += self.power(owned.facility)
        # Someone who sold little still expects to run some, or they would soon stop buying fuel.
        return max(0.4, used / capacity) if capacity else 1.0

    @property
    def full_season(self) -> bool:
        return self.session.round_format.trading_format == "full_season"

    def fuel_margin(self, share: float) -> float:
        """``share`` with a safety margin in a full-season Round, where fuel cannot be topped up for 13 weeks."""
        return max(share * 1.25, 0.6) if self.full_season else share

    def storage_prices(self, facility: FacilityId, buy_quantile: float, sell_quantile: float) -> tuple[float, float]:
        """Buy and sell prices for a storage facility at two quantiles of the last period's prices. The sell price is
        at least what makes up for the energy lost in storage, so a flat market leaves the storage idle.
        """
        prices = sorted(self.last.finite_prices) if self.last else []
        if not prices:
            return 60.0, 150.0
        buy = prices[int(buy_quantile * (len(prices) - 1))]
        sell = prices[int(sell_quantile * (len(prices) - 1))]
        efficiency = CATALOG[facility].base_efficiency or 0.7
        # One above the quantile, so the bid is not the marginal one at a price many points clear at.
        return round(buy) + 1, round(max(sell, (buy + 1) / efficiency + 1))

    def blackout_last_round(self) -> bool:
        return any(view.blackout and view.round == self.round - 1 for view in self.history)

    def forecast_seasons(self) -> set[Season]:
        """This Round's seasons that the Recap before it warned about."""
        year_ahead = self.recap.year_ahead if self.recap is not None else None
        return {forecast.season for forecast in year_ahead.forecasts} if year_ahead is not None else set()
