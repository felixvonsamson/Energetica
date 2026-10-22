"""What a blackout costs the players, and how far it rations demand (#1286)."""

from __future__ import annotations

import pytest

from energetica.workshop.blackout import Blackout, blackout_cost, blackout_cost_share, rationing
from energetica.workshop.player import WORKSHOP_CASH_FLOOR, round_start_money
from energetica.workshop.seasons import Season


@pytest.mark.parametrize(("count", "share"), [(0, 0.0), (1, 0.3), (2, 0.6), (3, 0.9), (4, 1.0), (7, 1.0)])
def test_each_blackout_costs_thirty_percent_of_the_operating_profit_up_to_all_of_it(count: int, share: float) -> None:
    assert blackout_cost_share(count) == pytest.approx(share)
    assert blackout_cost(100_000_000.0, count) == pytest.approx(100_000_000.0 * share)


def test_a_round_run_at_a_loss_costs_nothing() -> None:
    assert blackout_cost(-20_000_000.0, 2) == 0.0


def _blackout(round_number: int, season: Season, day: int) -> Blackout:
    return Blackout(round=round_number, season=season, day=day, minute=12 * 60)


def test_demand_is_rationed_by_ten_percent_for_each_blackout_earlier_in_the_round() -> None:
    blackouts = [_blackout(1, "winter", 300), _blackout(2, "spring", 10), _blackout(2, "spring", 20)]

    assert rationing(blackouts, 1, "winter") == 1.0
    assert rationing(blackouts, 2, "spring") == 1.0
    assert rationing(blackouts, 2, "summer") == pytest.approx(0.81)
    assert rationing(blackouts, 3, "spring") == 1.0


def test_the_floor_is_seventy_percent_of_the_starting_budget() -> None:
    assert WORKSHOP_CASH_FLOOR == 35_000_000.0
    assert round_start_money(10_000_000.0) == 35_000_000.0
    assert round_start_money(150_000_000.0) == 150_000_000.0
