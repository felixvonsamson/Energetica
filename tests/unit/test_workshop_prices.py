"""The prices a Workshop player offers their facilities' power at (#1002)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from energetica.workshop.facilities import CATALOG, FacilityId
from energetica.workshop.prices import DEFAULT_PRICES, DUMP_COST, PRICE_FLOOR, PriceSheet, is_storage


def test_the_price_floor_is_minus_the_dump_cost() -> None:
    assert (DUMP_COST, PRICE_FLOOR) == (25.0, -25.0)


def test_every_facility_type_has_a_default_sell_price() -> None:
    assert set(DEFAULT_PRICES.sell) == set(CATALOG)


def test_every_storage_type_and_only_storage_has_a_default_buy_price() -> None:
    assert set(DEFAULT_PRICES.buy) == {facility for facility in CATALOG if is_storage(facility)}


def test_no_default_price_is_below_the_floor() -> None:
    assert min([*DEFAULT_PRICES.sell.values(), *DEFAULT_PRICES.buy.values()]) >= PRICE_FLOOR


def test_a_facility_that_is_not_storage_cannot_have_a_buy_price() -> None:
    with pytest.raises(ValidationError):
        PriceSheet(sell={}, buy={FacilityId.GAS_BURNER: 10.0})


def test_setting_one_price_leaves_the_others() -> None:
    prices = DEFAULT_PRICES.with_price(FacilityId.LITHIUM_ION_BATTERIES, "buy", 12.5)

    assert prices.buy[FacilityId.LITHIUM_ION_BATTERIES] == 12.5
    assert prices.sell == DEFAULT_PRICES.sell
    assert DEFAULT_PRICES.buy[FacilityId.LITHIUM_ION_BATTERIES] == 425.0


def test_prices_narrow_to_some_facility_types() -> None:
    prices = DEFAULT_PRICES.only({FacilityId.GAS_BURNER, FacilityId.LITHIUM_ION_BATTERIES})

    assert prices == PriceSheet(
        sell={FacilityId.GAS_BURNER: 500.0, FacilityId.LITHIUM_ION_BATTERIES: 940.0},
        buy={FacilityId.LITHIUM_ION_BATTERIES: 425.0},
    )
