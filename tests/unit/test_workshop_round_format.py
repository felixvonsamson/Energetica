"""The round-format levers: trading-round format, clearings per day and storage availability (#1004)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from energetica.workshop.round_format import ClearingsPerDay, RoundFormat, StorageAvailability, TradingFormat


def test_a_round_starts_as_one_representative_day_cleared_hourly_with_batteries_only() -> None:
    assert RoundFormat() == RoundFormat(trading_format="representative_day", clearings_per_day=24, storage="batteries")


@pytest.mark.parametrize("storage", ["off", "batteries"])
def test_a_representative_day_round_allows_batteries_or_no_storage(storage: StorageAvailability) -> None:
    assert RoundFormat(trading_format="representative_day", storage=storage).storage == storage


def test_a_representative_day_round_cannot_allow_every_storage_type() -> None:
    with pytest.raises(ValidationError):
        RoundFormat(trading_format="representative_day", storage="all")


@pytest.mark.parametrize("storage", ["off", "batteries", "all"])
def test_a_full_season_round_allows_any_storage(storage: StorageAvailability) -> None:
    assert RoundFormat(trading_format="full_season", storage=storage).storage == storage


@pytest.mark.parametrize("clearings_per_day", [24, 96, 288])
@pytest.mark.parametrize("trading_format", ["representative_day", "full_season"])
def test_the_clearing_frequency_is_independent_of_the_format(
    clearings_per_day: ClearingsPerDay, trading_format: TradingFormat
) -> None:
    round_format = RoundFormat(trading_format=trading_format, clearings_per_day=clearings_per_day)

    assert round_format.clearings_per_day == clearings_per_day


def test_only_three_clearing_frequencies_exist() -> None:
    with pytest.raises(ValidationError):
        RoundFormat.model_validate({"clearings_per_day": 48})
