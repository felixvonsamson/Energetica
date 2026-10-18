"""A player's balance sheet for one Round, which the Round overview shows (#1008).

It has a column for each season and one for the Round. Each column breaks the player's operating income down
into market income, dumping cost, O&M and fuel, with the volumes and prices behind them. The Round column then takes
off the Round's investments to give its net profit. Operating income is added up by
:mod:`~energetica.workshop.operating_profit`, so the overview and the final score always agree.

The sheet fills in as the Round's Trading periods are settled: a season not settled yet has no figures, and
neither does one a blackout ended the Round before.

Fuel is paid for once per season (#1009), so each season's column has its own fuel cost.

A climate event's revenue tax (#1012) takes a share of the season's sale revenue. It comes off inside operating
income, above fuel.

The carbon tax (#1015) sits below operating income, which leaves it out. It breaks down into the tax on the CO₂
emitted building the Round's investments, charged in its first season, the tax on the CO₂ emitted generating, and
the player's share of the takings coming back. The Round's net profit takes it off along with the investments.

The loan (#1225) is shown in its own financing section, below net profit and apart from it, since borrowing money
is not a profit. The sheet of the Round the loan was taken in shows the money coming in, and the sheet of each Round
whose start took a payment shows that payment. A payment taken when the session ends shows on the last Round's sheet.
Over the session the financing lines add up to minus the loan's cost, which the final score counts as an investment.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from energetica.workshop.facilities import CATALOG, FacilityId, Fuel
from energetica.workshop.fleet import Purchase
from energetica.workshop.loan import LOAN_AMOUNT, LOAN_PAYMENT, LOAN_PAYMENTS, Loan, payment_round
from energetica.workshop.fuel import FUEL_NAMES
from energetica.workshop.operating_profit import period_operating_profit, round_operating_profit
from energetica.workshop.seasons import SEASONS, Season
from energetica.workshop.trading import FacilityPerformance, TradingResult

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


class MarketLine(BaseModel):
    """The energy one facility type sold, or bought, over a period, and the money it was worth."""

    model_config = ConfigDict(frozen=True)

    facility: FacilityId
    name: str
    energy: float = Field(description="In Wh")
    amount: float = Field(description="The sale revenue, or the purchase cost")


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
    sold: list[MarketLine] = Field(description="One line per facility type that sold energy, in catalog order")
    energy_bought: float = Field(description="Energy storage bought to charge")
    purchase_cost: float
    bought: list[MarketLine] = Field(description="One line per facility type that bought energy, in catalog order")
    market_income: float = Field(description="Sale revenue minus the cost of the energy bought")
    energy_dumped: float = Field(description="Renewable energy that did not sell")
    dump_cost: float
    om: list[OmLine] = Field(description="One line per facility type that was operating, in catalog order")
    om_total: float
    # Default to none for a sheet without a revenue tax.
    revenue_tax: float = Field(default=0.0, description="What climate events took off sale revenue")
    taxable_revenue: float = Field(
        default=0.0, description="The sale revenue of the seasons a climate event taxed. Zero if none was"
    )
    revenue_tax_rate: float = Field(
        default=0.0,
        description="The revenue tax as a share of the taxable revenue, from 0 to 1. Over several taxed seasons, "
        "their average",
    )
    # Default to none for a sheet without fuel.
    fuel: list[FuelLine] = Field(default=[], description="One line per fuel paid for, in the order of the fuels")
    fuel_total: float = 0.0
    operating_income: float = Field(description="Market income minus dumping cost, O&M, revenue tax and fuel")
    # Default to zero for a sheet without a carbon tax.
    construction_emissions: float = Field(
        default=0.0, description="The CO₂ emitted building the Round's investments that the carbon tax charged, in kg"
    )
    construction_carbon_tax: float = Field(
        default=0.0, description="The carbon tax on construction_emissions, charged in the Round's first season"
    )
    taxed_emissions: float = Field(
        default=0.0, description="The CO₂ emitted generating in the seasons the carbon tax was in force, in kg"
    )
    emitted_carbon_tax: float = Field(default=0.0, description="The carbon tax on taxed_emissions")
    carbon_tax_rate: float = Field(
        default=0.0, description="What the carbon tax charged per kg of CO₂, or zero if it was not in force"
    )
    carbon_tax_share: float = Field(default=0.0, description="The player's share of the carbon tax takings")
    carbon_tax: float = Field(
        default=0.0,
        description="The carbon tax paid on construction and generation, minus the share that came back. Below zero "
        "when more came back than was paid",
    )


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


class FinancingLine(BaseModel):
    """The loan coming in, or one of its payments going out (#1225)."""

    model_config = ConfigDict(frozen=True)

    kind: Literal["loan", "loan_payment"]
    amount: float = Field(description="Above zero for the loan coming in, below zero for a payment")
    payment: int | None = Field(description="Which payment it is, from 1, or None for the loan itself")
    payment_count: int = Field(description="How many payments pay the loan back")
    at_session_end: bool = Field(description="Whether the payment was taken when the session ended")


class BalanceSheet(BaseModel):
    """A player's balance sheet for one Round."""

    model_config = ConfigDict(frozen=True)

    round: int
    seasons: list[SeasonSheet] = Field(description="One per season, in the order they run")
    total: PeriodSheet | None = Field(description="The settled seasons added up, or None if none is settled yet")
    investments: list[InvestmentLine] = Field(description="One line per facility type bought, in catalog order")
    investment_total: float
    net_profit: float = Field(
        description="The Round's operating income so far minus its carbon tax so far and its investments"
    )
    financing: list[FinancingLine] = Field(
        description="The loan coming in this Round, and the payments taken at its start or at the session end. Not "
        "part of net profit"
    )
    financing_total: float


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


def _market_lines(
    performances: Sequence[tuple[FacilityId, FacilityPerformance]], side: Literal["sold", "bought"]
) -> list[MarketLine]:
    """The energy each facility type sold, or bought, added up, leaving out the types with none."""
    sold = side == "sold"
    energy: dict[FacilityId, float] = {}
    amounts: dict[FacilityId, float] = {}
    for facility, performance in performances:
        energy[facility] = energy.get(facility, 0.0) + (performance.sold if sold else performance.bought)
        amounts[facility] = amounts.get(facility, 0.0) + (performance.revenue if sold else performance.purchase_cost)
    return [
        MarketLine(facility=facility, name=CATALOG[facility].name, energy=energy[facility], amount=amounts[facility])
        for facility in sorted(energy, key=_catalog_order)
        if energy[facility] > 0
    ]


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
    revenue_tax = sum(result.revenue_tax for result in results)
    taxable_revenue = sum(result.revenue for result in results if result.revenue_tax_rate > 0)
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
        sold=_market_lines(performances, "sold"),
        energy_bought=sum(performance.bought for _, performance in performances),
        purchase_cost=purchase_cost,
        bought=_market_lines(performances, "bought"),
        market_income=sale_revenue - purchase_cost,
        energy_dumped=sum(performance.dumped for _, performance in performances),
        dump_cost=dump_cost,
        om=sorted(om.values(), key=lambda line: _catalog_order(line.facility)),
        om_total=om_total,
        revenue_tax=revenue_tax,
        taxable_revenue=taxable_revenue,
        revenue_tax_rate=revenue_tax / taxable_revenue if taxable_revenue else 0.0,
        fuel=fuel,
        fuel_total=sum(line.cost for line in fuel),
        operating_income=sum(period_operating_profit(result) for result in results),
        construction_emissions=sum(result.construction_emissions for result in results),
        construction_carbon_tax=sum(result.construction_carbon_tax for result in results),
        taxed_emissions=sum(result.emissions for result in results if result.carbon_tax_rate > 0),
        emitted_carbon_tax=sum(result.emitted_carbon_tax for result in results),
        # The rate is the same in every season a Round taxes: a carbon tax stays once it passes.
        carbon_tax_rate=max((result.carbon_tax_rate for result in results), default=0.0),
        carbon_tax_share=sum(result.carbon_tax_share for result in results),
        carbon_tax=sum(result.carbon_tax for result in results),
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


def financing(loan: Loan | None, round_number: int, *, round_count: int) -> list[FinancingLine]:
    """The financing lines of Round ``round_number``'s sheet, in a session of ``round_count`` Rounds: the loan if it
    was taken in it, then each payment made that belongs to it.
    """
    if loan is None:
        return []
    lines = []
    if loan.round == round_number:
        lines.append(
            FinancingLine(
                kind="loan", amount=LOAN_AMOUNT, payment=None, payment_count=LOAN_PAYMENTS, at_session_end=False
            )
        )
    for index in range(loan.payments_made):
        due = payment_round(loan, index)
        if min(due, round_count) == round_number:
            lines.append(
                FinancingLine(
                    kind="loan_payment",
                    amount=-LOAN_PAYMENT,
                    payment=index + 1,
                    payment_count=LOAN_PAYMENTS,
                    at_session_end=due > round_count,
                )
            )
    return lines


def balance_sheet(
    round_number: int,
    *,
    results: Sequence[TradingResult],
    purchases: Iterable[Purchase],
    settled: tuple[int, Season] | None,
    blackouts: Sequence[tuple[int, Season]],
    loan: Loan | None = None,
    round_count: int,
) -> BalanceSheet:
    """A player's balance sheet for Round ``round_number`` of ``round_count``, from their Trading-period ``results``,
    ``purchases`` and ``loan``. ``settled`` is the last Trading period settled, and ``blackouts`` the periods the
    grid went down in.

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
    financing_lines = financing(loan, round_number, round_count=round_count)
    return BalanceSheet(
        round=round_number,
        seasons=seasons,
        total=period_sheet(round_results) if any_settled else None,
        investments=lines,
        investment_total=investment_total,
        net_profit=round_operating_profit(results, round_number)
        - sum(result.carbon_tax for result in round_results)
        - investment_total,
        financing=financing_lines,
        financing_total=sum(line.amount for line in financing_lines),
    )
