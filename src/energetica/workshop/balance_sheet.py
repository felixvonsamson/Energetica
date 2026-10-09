"""A player's balance sheet for one Round, which the Round overview shows (#1008).

It has a column for each season and one for the Round. Each column breaks the player's operating income down
into market income, dumping cost, O&M and fuel, with the volumes and prices behind them. The Round column then takes
off the Round's investments to give its net profit. Operating income is added up by
:mod:`~energetica.workshop.operating_profit`, so the overview and the final score always agree.

The sheet fills in as the Round's Trading periods are settled: a season not settled yet has no figures, and
neither does one a blackout ended the Round before.

Fuel is paid for once per season (#1009), so each season's column has its own fuel cost.

Two parts are still to come. The climate-event revenue tax (#1012) comes off market income inside operating
income, as #1006 already counts it. The carbon tax (#1015) sits below operating income, which leaves it out,
beside the investments.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from energetica.workshop.facilities import CATALOG, FacilityId, Fuel
from energetica.workshop.fleet import Purchase
from energetica.workshop.fuel import FUEL_NAMES
from energetica.workshop.operating_profit import period_operating_profit, round_operating_profit
from energetica.workshop.seasons import SEASONS, Season
from energetica.workshop.trading import TradingResult

SeasonStatus = Literal["settled", "upcoming", "skipped"]


class OmLine(BaseModel):
    """The O&M of one facility type over a period."""

    model_config = ConfigDict(frozen=True)

    facility: FacilityId
    name: str
    count: int = Field(description="How many facilities of the type were operating")
    om: float = Field(description="O&M charged: the fixed part plus the variable part")
    fixed: float = Field(description="The part charged whatever the use")
    variable_full: float = Field(description="The variable part at full use")
    usage: float = Field(description="Capacity factor, from 0 to 1. The variable part charged is variable_full × usage")


class FuelLine(BaseModel):
    """The fuel of one type paid for over a period."""

    model_config = ConfigDict(frozen=True)

    fuel: Fuel
    name: str
    quantity: float = Field(description="In kg")
    price: float = Field(description="Average price per kg: the cost divided by the quantity")
    cost: float


class PeriodSheet(BaseModel):
    """What a player earned and spent running their fleet over a season, or over the Round so far.

    Energy is in Wh. Average prices are the money divided by the energy.
    """

    model_config = ConfigDict(frozen=True)

    energy_sold: float
    sale_revenue: float
    energy_bought: float = Field(description="Energy storage bought to charge")
    purchase_cost: float
    market_income: float = Field(description="Sale revenue minus the cost of the energy bought")
    energy_dumped: float = Field(description="Renewable energy that did not sell")
    dump_cost: float
    om: list[OmLine] = Field(description="One line per facility type that was operating, in catalog order")
    om_total: float
    # Default to none for a sheet without fuel.
    fuel: list[FuelLine] = Field(default=[], description="One line per fuel paid for, in the order of the fuels")
    fuel_total: float = 0.0
    operating_income: float = Field(description="Market income minus dumping cost, O&M and fuel")


class SeasonSheet(BaseModel):
    """One season's column of the balance sheet."""

    model_config = ConfigDict(frozen=True)

    season: Season
    status: SeasonStatus = Field(
        description="settled: simulated, with figures. upcoming: not simulated yet. skipped: a blackout earlier in "
        "the Round ended it before this season"
    )
    blackout: bool = Field(description="Whether a blackout ended the Round in this season")
    sheet: PeriodSheet | None = Field(description="The season's figures, if it is settled")


class InvestmentLine(BaseModel):
    """The facilities of one type bought in the Round's Investment phase."""

    model_config = ConfigDict(frozen=True)

    facility: FacilityId
    name: str
    count: int
    cost: float


class BalanceSheet(BaseModel):
    """A player's balance sheet for one Round."""

    model_config = ConfigDict(frozen=True)

    round: int
    seasons: list[SeasonSheet] = Field(description="One per season, in the order they run")
    total: PeriodSheet | None = Field(description="The settled seasons added up, or None if none is settled yet")
    investments: list[InvestmentLine] = Field(description="One line per facility type bought, in catalog order")
    investment_total: float
    net_profit: float = Field(description="The Round's operating income so far minus its investments")


def _position(round_number: int, season: Season) -> tuple[int, int]:
    return round_number, SEASONS.index(season)


def season_status(
    round_number: int, season: Season, *, settled: tuple[int, Season] | None, blackouts: Sequence[tuple[int, Season]]
) -> SeasonStatus:
    """Whether a season has been settled, is still to come, or was skipped by a blackout earlier in its Round.

    ``settled`` is the last Trading period settled, and ``blackouts`` the periods the grid went down in.
    """
    for blackout_round, blackout_season in blackouts:
        if blackout_round == round_number and SEASONS.index(season) > SEASONS.index(blackout_season):
            return "skipped"
    if settled is not None and _position(round_number, season) <= _position(*settled):
        return "settled"
    return "upcoming"


def _catalog_order(facility: FacilityId) -> int:
    return list(FacilityId).index(facility)


def period_sheet(results: Sequence[TradingResult]) -> PeriodSheet:
    """The figures of ``results`` added up: one result for a season, or a Round's settled ones for its total."""
    performances = [
        (facility, performance) for result in results for facility, performance in result.facilities.items()
    ]
    om: dict[FacilityId, OmLine] = {}
    for facility, performance in performances:
        line = om.get(facility)
        fixed = performance.om_fixed + (line.fixed if line else 0.0)
        variable_full = performance.om_variable_full + (line.variable_full if line else 0.0)
        charged = performance.om + (line.om if line else 0.0)
        variable = charged - fixed
        om[facility] = OmLine(
            facility=facility,
            name=CATALOG[facility].name,
            # Facilities are bought and retired between Rounds, so every season of a Round has the same count.
            count=max(performance.count, line.count if line else 0),
            om=charged,
            fixed=fixed,
            variable_full=variable_full,
            usage=variable / variable_full if variable_full else performance.capacity_factor,
        )
    sale_revenue = sum(performance.revenue for _, performance in performances)
    purchase_cost = sum(performance.purchase_cost for _, performance in performances)
    dump_cost = sum(performance.dump_cost for _, performance in performances)
    om_total = sum(line.om for line in om.values())
    quantities: dict[Fuel, float] = {}
    costs: dict[Fuel, float] = {}
    for result in results:
        for purchase in result.fuel:
            quantities[purchase.fuel] = quantities.get(purchase.fuel, 0.0) + purchase.quantity
            costs[purchase.fuel] = costs.get(purchase.fuel, 0.0) + purchase.cost
    fuel = [
        FuelLine(
            fuel=fuel,
            name=FUEL_NAMES[fuel],
            quantity=quantities[fuel],
            price=costs[fuel] / quantities[fuel],
            cost=costs[fuel],
        )
        for fuel in Fuel
        if quantities.get(fuel, 0.0) > 0
    ]
    return PeriodSheet(
        energy_sold=sum(performance.sold for _, performance in performances),
        sale_revenue=sale_revenue,
        energy_bought=sum(performance.bought for _, performance in performances),
        purchase_cost=purchase_cost,
        market_income=sale_revenue - purchase_cost,
        energy_dumped=sum(performance.dumped for _, performance in performances),
        dump_cost=dump_cost,
        om=sorted(om.values(), key=lambda line: _catalog_order(line.facility)),
        om_total=om_total,
        fuel=fuel,
        fuel_total=sum(line.cost for line in fuel),
        operating_income=sum(period_operating_profit(result) for result in results),
    )


def investments(purchases: Iterable[Purchase], round_number: int) -> list[InvestmentLine]:
    """The facilities bought in Round ``round_number``, one line per type."""
    lines: dict[FacilityId, InvestmentLine] = {}
    for purchase in purchases:
        if purchase.round != round_number:
            continue
        line = lines.get(purchase.facility)
        lines[purchase.facility] = InvestmentLine(
            facility=purchase.facility,
            name=CATALOG[purchase.facility].name,
            count=(line.count if line else 0) + 1,
            cost=(line.cost if line else 0.0) + purchase.price,
        )
    return sorted(lines.values(), key=lambda line: _catalog_order(line.facility))


def balance_sheet(
    round_number: int,
    *,
    results: Sequence[TradingResult],
    purchases: Iterable[Purchase],
    settled: tuple[int, Season] | None,
    blackouts: Sequence[tuple[int, Season]],
) -> BalanceSheet:
    """A player's balance sheet for Round ``round_number``, from their Trading-period ``results`` and
    ``purchases``. ``settled`` is the last Trading period settled, and ``blackouts`` the periods the grid went
    down in.

    A settled season in which the player had nothing operating has no result, and shows zero throughout.
    """
    round_results = [result for result in results if result.round == round_number]
    seasons = []
    for season in SEASONS:
        status = season_status(round_number, season, settled=settled, blackouts=blackouts)
        season_results = [result for result in round_results if result.season == season]
        seasons.append(
            SeasonSheet(
                season=season,
                status=status,
                blackout=(round_number, season) in blackouts,
                sheet=period_sheet(season_results) if status == "settled" else None,
            )
        )
    any_settled = any(season.status == "settled" for season in seasons)
    lines = investments(purchases, round_number)
    investment_total = sum(line.cost for line in lines)
    return BalanceSheet(
        round=round_number,
        seasons=seasons,
        total=period_sheet(round_results) if any_settled else None,
        investments=lines,
        investment_total=investment_total,
        net_profit=round_operating_profit(results, round_number) - investment_total,
    )
