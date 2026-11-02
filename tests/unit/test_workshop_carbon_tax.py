"""The carbon tax (#1015): each Trading period, the CO₂ every settled player emitted is taxed, and the takings are shared
out equally among them.
"""

from __future__ import annotations

import pytest

from energetica.workshop.carbon_tax import carbon_tax_rate, settle_carbon_tax
from energetica.workshop.facilities import FacilityId
from energetica.workshop.operating_profit import period_operating_profit
from energetica.workshop.trading import FacilityPerformance, TradingResult
from energetica.workshop.votes import CARBON_TAX_RATE, VoteOutcome

COAL = FacilityId.COAL_BURNER


def _result(*, emissions: float = 0.0, revenue: float = 0.0) -> TradingResult:
    performance = FacilityPerformance(
        generation=0.0,
        sold=0.0,
        dumped=0.0,
        bought=0.0,
        revenue=revenue,
        dump_cost=0.0,
        purchase_cost=0.0,
        om=0.0,
        emissions=emissions,
        capacity_factor=0.0,
    )
    return TradingResult(round=2, season="spring", facilities={COAL: performance})


def test_the_tax_applies_from_the_round_whose_vote_passed() -> None:
    outcomes = [VoteOutcome(round=2, passed=False), VoteOutcome(round=3, passed=True)]

    assert carbon_tax_rate(outcomes, 2) == 0.0
    assert carbon_tax_rate(outcomes, 3) == CARBON_TAX_RATE
    assert carbon_tax_rate(outcomes, 4) == CARBON_TAX_RATE
    assert carbon_tax_rate([], 4) == 0.0


def test_each_player_pays_on_what_they_emitted_and_gets_an_equal_share_of_the_pool() -> None:
    settled = settle_carbon_tax(
        {1: _result(emissions=1_000.0), 2: _result(emissions=200.0), 3: None},
        rate=0.5,
        round_number=2,
        season="spring",
    )

    takings = (1_000.0 + 200.0) * 0.5
    assert settled[1].emitted_carbon_tax == pytest.approx(500.0)
    assert settled[2].emitted_carbon_tax == pytest.approx(100.0)
    assert [settled[player].carbon_tax_share for player in (1, 2, 3)] == pytest.approx([takings / 3] * 3)
    assert sum(result.carbon_tax for result in settled.values()) == pytest.approx(0.0)


def test_a_player_with_nothing_operating_still_gets_a_share() -> None:
    settled = settle_carbon_tax({1: _result(emissions=1_000.0), 2: None}, rate=0.5, round_number=2, season="summer")

    assert settled[2].facilities == {}
    assert (settled[2].round, settled[2].season) == (2, "summer")
    assert settled[2].carbon_tax == pytest.approx(-250.0)


def test_without_the_tax_nothing_changes_and_nobody_gets_an_empty_result() -> None:
    result = _result(emissions=1_000.0)

    settled = settle_carbon_tax({1: result, 2: None}, rate=0.0, round_number=2, season="spring")

    assert settled == {1: result}


def test_with_nothing_emitted_nobody_gets_an_empty_result() -> None:
    settled = settle_carbon_tax({1: _result(), 2: None}, rate=0.5, round_number=2, season="spring")

    assert list(settled) == [1]
    assert settled[1].carbon_tax == 0.0


def test_the_carbon_tax_is_left_out_of_the_operating_profit() -> None:
    result = _result(emissions=1_000.0, revenue=3_000.0)
    settled = settle_carbon_tax({1: result, 2: None}, rate=0.5, round_number=2, season="spring")

    assert period_operating_profit(settled[1]) == pytest.approx(3_000.0)
    assert settled[1].carbon_tax == pytest.approx(500.0 - 250.0)


def test_settling_never_taxes_building() -> None:
    settled = settle_carbon_tax({1: _result(emissions=1_000.0)}, rate=0.5, round_number=2, season="spring")

    assert settled[1].carbon_tax_paid == pytest.approx(500.0)
