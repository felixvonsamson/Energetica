"""The final score and the scoreboard (#1017, #1222), worked out from constructed players."""

from __future__ import annotations

import pytest

from energetica.identity.accounts import Account
from energetica.identity.instance_config import InstanceConfig
from energetica.workshop.facilities import CATALOG, FacilityId
from energetica.workshop.final_score import final_score, residual_value, scoreboard
from energetica.workshop.fleet import OwnedFacility, Purchase
from energetica.workshop.network import WorkshopNetwork
from energetica.workshop.player import WorkshopPlayer, round_start_money
from energetica.workshop.setup import open_workshop_run
from energetica.workshop.trading import FacilityPerformance, TradingResult

GAS = FacilityId.GAS_BURNER  # lifetime 3, no construction lag
NUCLEAR = FacilityId.NUCLEAR_REACTOR  # lifetime 6, construction lag 1
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


def _result(
    round_number: int,
    revenue: float,
    *,
    emissions: float = 0.0,
    carbon_tax_rate: float = 0.0,
    carbon_tax_share: float = 0.0,
) -> TradingResult:
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
    return TradingResult(
        round=round_number,
        season="spring",
        facilities={GAS: performance},
        carbon_tax_rate=carbon_tax_rate,
        carbon_tax_share=carbon_tax_share,
    )


def test_a_facility_is_worth_its_price_times_the_share_of_its_lifetime_left_after_the_session() -> None:
    # Built in Round 4, it works Rounds 4 to 6, so after a 5-Round session it has Round 6 left.
    owned = OwnedFacility(facility=GAS, built_round=4)

    assert residual_value(owned, round_count=ROUNDS) == pytest.approx(CATALOG[GAS].base_price / 3)


def test_a_facility_whose_life_ends_with_the_last_round_is_worth_nothing() -> None:
    assert residual_value(OwnedFacility(facility=GAS, built_round=3), round_count=ROUNDS) == 0.0
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


def test_the_score_is_operating_profit_less_investments_and_carbon_tax_plus_residual_value(
    network: WorkshopNetwork,
) -> None:
    alice = _player(network, 1, "alice")
    alice.trading_results = [
        _result(1, 50_000.0),
        _result(3, 25_000.0, emissions=1_000.0, carbon_tax_rate=2.0, carbon_tax_share=500.0),
    ]
    alice.owned_facilities = [
        OwnedFacility(facility=GAS, built_round=4),
        OwnedFacility(facility=NUCLEAR, built_round=ROUNDS),
    ]
    # The price paid counts, price shock and all, and so does a facility that has since retired.
    alice.purchases = [
        Purchase(facility=GAS, round=1, price=30_000.0),
        Purchase(facility=GAS, round=4, price=45_000.0),
        Purchase(facility=NUCLEAR, round=ROUNDS, price=200_000.0),
    ]

    score = final_score(alice, round_count=ROUNDS)

    residual = CATALOG[GAS].base_price / 3 + CATALOG[NUCLEAR].base_price
    assert score.operating_profit == pytest.approx(75_000.0)
    assert score.investments == pytest.approx(275_000.0)
    assert score.carbon_tax == pytest.approx(1_000.0 * 2.0 - 500.0)
    assert score.residual_value == pytest.approx(residual)
    assert score.score == pytest.approx(75_000.0 - 275_000.0 - 1_500.0 + residual)


def test_a_carbon_tax_share_above_what_the_player_paid_raises_their_score(network: WorkshopNetwork) -> None:
    alice = _player(network, 1, "alice")
    alice.trading_results = [_result(1, 0.0, emissions=100.0, carbon_tax_rate=1.0, carbon_tax_share=400.0)]

    score = final_score(alice, round_count=ROUNDS)

    assert score.carbon_tax == pytest.approx(-300.0)
    assert score.score == pytest.approx(300.0)


@pytest.mark.parametrize(
    "money",
    [
        pytest.param(-243_000_000.0, id="deep in debt"),
        pytest.param(round_start_money(-243_000_000.0, after_blackout=False), id="after the floor top-up"),
        pytest.param(200_000_000.0, id="rich"),
        pytest.param(round_start_money(200_000_000.0, after_blackout=True), id="after the blackout reset"),
    ],
)
def test_cash_has_no_effect_on_the_score(network: WorkshopNetwork, money: float) -> None:
    alice = _player(network, 1, "alice")
    alice.trading_results = [_result(1, 50_000.0)]
    alice.purchases = [Purchase(facility=GAS, round=1, price=30_000.0)]
    before = final_score(alice, round_count=ROUNDS)

    alice.money = money

    assert final_score(alice, round_count=ROUNDS) == before


def test_the_scoreboard_ranks_the_highest_score_first(network: WorkshopNetwork) -> None:
    for account_id, (username, profit) in enumerate((("low", 100.0), ("high", 900.0), ("middle", 500.0)), start=1):
        _player(network, account_id, username).trading_results = [_result(1, profit)]

    board = scoreboard(network.players(), round_count=ROUNDS)

    assert [score.username for score in board] == ["high", "middle", "low"]
