"""The final score and the scoreboard (#1017), worked out from constructed players."""

from __future__ import annotations

import pytest

from energetica.identity.accounts import Account
from energetica.identity.instance_config import InstanceConfig
from energetica.workshop.facilities import CATALOG, FacilityId
from energetica.workshop.final_score import final_score, residual_value, scoreboard
from energetica.workshop.fleet import OwnedFacility
from energetica.workshop.network import WorkshopNetwork
from energetica.workshop.player import WorkshopPlayer
from energetica.workshop.setup import open_workshop_run
from energetica.workshop.trading import FacilityPerformance, TradingResult

GAS = FacilityId.GAS_BURNER  # lifetime 4, no construction lag
NUCLEAR = FacilityId.NUCLEAR_REACTOR  # lifetime 8, construction lag 1
BATTERIES = FacilityId.LITHIUM_ION_BATTERIES  # lifetime 1
ROUNDS = 5

WORKSHOP_CONFIG = InstanceConfig.model_validate(
    {
        "name": "Workshop",
        "advertised": False,
        "starts_at": "2026-03-01T00:00:00Z",
        "run": {"mode": "workshop"},
    }
)


@pytest.fixture
def network() -> WorkshopNetwork:
    return open_workshop_run(WORKSHOP_CONFIG)


def _player(network: WorkshopNetwork, account_id: int, username: str) -> WorkshopPlayer:
    account = Account(account_id=account_id, username=username, pwhash="hash", email=None, created_at="")
    return network.join(account)


def _result(round_number: int, revenue: float) -> TradingResult:
    performance = FacilityPerformance(
        generation=0.0,
        sold=0.0,
        dumped=0.0,
        bought=0.0,
        revenue=revenue,
        dump_cost=0.0,
        purchase_cost=0.0,
        om=0.0,
        emissions=0.0,
        capacity_factor=0.0,
    )
    return TradingResult(round=round_number, season="spring", facilities={GAS: performance})


def test_a_facility_is_worth_its_price_times_the_share_of_its_lifetime_left_after_the_session() -> None:
    # Built in Round 4, it works Rounds 4 to 7, so after a 5-Round session it has Rounds 6 and 7 left.
    owned = OwnedFacility(facility=GAS, built_round=4)

    assert residual_value(owned, round_count=ROUNDS) == pytest.approx(CATALOG[GAS].base_price * 2 / 4)


def test_a_facility_whose_life_ends_with_the_last_round_is_worth_nothing() -> None:
    assert residual_value(OwnedFacility(facility=GAS, built_round=2), round_count=ROUNDS) == 0.0
    assert residual_value(OwnedFacility(facility=BATTERIES, built_round=ROUNDS), round_count=ROUNDS) == 0.0


def test_a_facility_still_under_construction_pays_back_its_full_price() -> None:
    owned = OwnedFacility(facility=NUCLEAR, built_round=ROUNDS)

    assert residual_value(owned, round_count=ROUNDS) == CATALOG[NUCLEAR].base_price


def test_stored_energy_is_not_worth_anything(network: WorkshopNetwork) -> None:
    empty, full = _player(network, 1, "empty"), _player(network, 2, "full")
    for player in (empty, full):
        player.owned_facilities = [OwnedFacility(facility=FacilityId.PUMPED_HYDRO, built_round=ROUNDS)]
    full.stored_energy = {FacilityId.PUMPED_HYDRO: 4e9}

    assert final_score(full, round_count=ROUNDS).residual_value == final_score(empty, round_count=ROUNDS).residual_value


def test_the_score_adds_operating_profit_cash_and_residual_value(network: WorkshopNetwork) -> None:
    alice = _player(network, 1, "alice")
    alice.money = 300_000.0
    alice.trading_results = [_result(1, 50_000.0), _result(3, 25_000.0)]
    alice.owned_facilities = [
        OwnedFacility(facility=GAS, built_round=4),
        OwnedFacility(facility=NUCLEAR, built_round=ROUNDS),
    ]

    score = final_score(alice, round_count=ROUNDS)

    residual = CATALOG[GAS].base_price / 2 + CATALOG[NUCLEAR].base_price
    assert score.operating_profit == pytest.approx(75_000.0)
    assert score.cash == 300_000.0
    assert score.residual_value == pytest.approx(residual)
    assert score.score == pytest.approx(75_000.0 + 300_000.0 + residual)


def test_the_scoreboard_ranks_the_highest_score_first(network: WorkshopNetwork) -> None:
    for account_id, (username, money) in enumerate((("low", 100.0), ("high", 900.0), ("middle", 500.0)), start=1):
        _player(network, account_id, username).money = money

    board = scoreboard(network.players(), round_count=ROUNDS)

    assert [score.username for score in board] == ["high", "middle", "low"]
