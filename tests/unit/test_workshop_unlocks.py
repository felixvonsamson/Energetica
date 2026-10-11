"""Which facilities a Workshop session offers, and how the storage lever changes them (#998, #1004)."""

from __future__ import annotations

from energetica.workshop.facilities import CATALOG, FacilityId
from energetica.workshop.fleet import Purchase
from energetica.workshop.prices import is_storage
from energetica.workshop.round_format import StorageAvailability
from energetica.workshop.player import WORKSHOP_STARTING_BUDGET
from energetica.workshop.unlocks import (
    Unlock,
    available_facilities,
    format_lever_unlocks,
    invested,
    round_end_unlocks,
    unlock_threshold,
)


def _offered(storage: StorageAvailability) -> set[FacilityId]:
    return {facility.id for facility in available_facilities(storage)}


def test_batteries_only_offers_the_starting_facilities() -> None:
    assert FacilityId.LITHIUM_ION_BATTERIES in _offered("batteries")
    assert FacilityId.HYDROGEN_STORAGE not in _offered("batteries")
    assert FacilityId.PUMPED_HYDRO not in _offered("batteries")


def test_no_storage_offers_no_storage_at_all() -> None:
    assert not any(is_storage(facility) for facility in _offered("off"))


def test_every_storage_type_adds_hydrogen_storage_and_pumped_hydro() -> None:
    assert _offered("all") == _offered("batteries") | {FacilityId.HYDROGEN_STORAGE, FacilityId.PUMPED_HYDRO}


def test_the_storage_lever_leaves_generation_alone() -> None:
    generation = {facility for facility in _offered("batteries") if not is_storage(facility)}

    assert {facility for facility in _offered("off") if not is_storage(facility)} == generation
    assert {facility for facility in _offered("all") if not is_storage(facility)} == generation


def test_facilities_are_offered_in_catalog_order() -> None:
    order = list(CATALOG)

    offered = [facility.id for facility in available_facilities("all")]

    assert offered == sorted(offered, key=order.index)


# --- tech-grade unlocks (#1011) --------------------------------------------------------------


def _purchase(facility: FacilityId, price: float, round_number: int = 1) -> Purchase:
    return Purchase(facility=facility, round=round_number, price=price)


def test_spend_on_each_base_technology_adds_up_across_purchases() -> None:
    spent = invested(
        [
            _purchase(FacilityId.ONSHORE_WIND_TURBINE, 100.0),
            _purchase(FacilityId.ONSHORE_WIND_TURBINE, 50.0, round_number=2),
            _purchase(FacilityId.GAS_BURNER, 30.0),
        ]
    )

    assert spent[FacilityId.ONSHORE_WIND_TURBINE] == 150.0
    assert spent[FacilityId.GAS_BURNER] == 30.0
    assert spent[FacilityId.COAL_BURNER] == 0.0


def test_spend_on_upgrades_and_standalone_facilities_counts_toward_nothing() -> None:
    spent = invested(
        [
            _purchase(FacilityId.OFFSHORE_WIND_TURBINE, 100.0),
            _purchase(FacilityId.CSP_SOLAR, 100.0),
            _purchase(FacilityId.HYDROGEN_STORAGE, 100.0),
        ]
    )

    assert set(spent.values()) == {0.0}


def test_the_threshold_is_half_of_every_players_starting_budget() -> None:
    assert unlock_threshold(player_count=4) == 2 * WORKSHOP_STARTING_BUDGET


def _round_end(
    spent: dict[FacilityId, float], *, next_round: int = 2, unlocked: frozenset[FacilityId] = frozenset()
) -> list[Unlock]:
    return round_end_unlocks(
        next_round=next_round, spent={**invested([]), **spent}, threshold=1_000.0, unlocked=unlocked
    )


def test_an_upgrade_unlocks_from_the_next_round_once_spend_on_its_base_tier_reaches_the_threshold() -> None:
    unlocks = _round_end({FacilityId.GAS_BURNER: 1_000.0, FacilityId.COAL_BURNER: 999.0})

    assert unlocks == [Unlock(facility=FacilityId.COMBINED_CYCLE, round=2, trigger="investment_threshold")]


def test_an_upgrade_unlocks_only_once() -> None:
    assert _round_end({FacilityId.GAS_BURNER: 5_000.0}, unlocked=frozenset({FacilityId.COMBINED_CYCLE})) == []


def test_concentrated_solar_power_unlocks_from_round_three_whatever_was_invested() -> None:
    assert _round_end({}, next_round=2) == []
    assert _round_end({}, next_round=3) == [Unlock(facility=FacilityId.CSP_SOLAR, round=3, trigger="round_gate")]
    assert _round_end({}, next_round=4, unlocked=frozenset({FacilityId.CSP_SOLAR})) == []


def test_nothing_unlocks_without_spend_even_if_the_threshold_is_zero() -> None:
    assert round_end_unlocks(next_round=2, spent=invested([]), threshold=0.0, unlocked=frozenset()) == []


def test_full_season_storage_unlocks_the_first_round_the_storage_lever_allows_every_type() -> None:
    assert format_lever_unlocks(round_number=2, storage="batteries", unlocked=frozenset()) == []
    assert format_lever_unlocks(round_number=2, storage="all", unlocked=frozenset()) == [
        Unlock(facility=FacilityId.HYDROGEN_STORAGE, round=2, trigger="format_lever"),
        Unlock(facility=FacilityId.PUMPED_HYDRO, round=2, trigger="format_lever"),
    ]
    already = frozenset({FacilityId.HYDROGEN_STORAGE, FacilityId.PUMPED_HYDRO})
    assert format_lever_unlocks(round_number=3, storage="all", unlocked=already) == []


def test_an_unlocked_facility_is_offered() -> None:
    unlocked = {FacilityId.COMBINED_CYCLE, FacilityId.CSP_SOLAR}

    offered = {facility.id for facility in available_facilities("batteries", unlocked)}

    assert offered == _offered("batteries") | unlocked


def test_the_storage_lever_still_holds_back_an_unlocked_storage_upgrade() -> None:
    unlocked = {FacilityId.SOLID_STATE_BATTERIES}

    assert FacilityId.SOLID_STATE_BATTERIES in {f.id for f in available_facilities("batteries", unlocked)}
    assert FacilityId.SOLID_STATE_BATTERIES not in {f.id for f in available_facilities("off", unlocked)}


def test_full_season_storage_follows_the_current_lever_even_once_unlocked() -> None:
    unlocked = {FacilityId.HYDROGEN_STORAGE, FacilityId.PUMPED_HYDRO}

    assert not unlocked & {facility.id for facility in available_facilities("batteries", unlocked)}
