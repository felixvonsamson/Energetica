"""
Tests for the Workshop bots in `scripts/workshop_bots/`.

The bots used to order every fuel under manual procurement. The server refuses an order for a fuel the player's
operating facilities do not burn, and the refusal ended the bot's turn before it ordered the fuels it does burn
(#1512). These tests build a bot's context from a stand-in for the API, with no server.
"""

from __future__ import annotations

import importlib.util
import sys
from collections.abc import Iterator
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Any

import pytest

from energetica.workshop.facilities import Fuel
from energetica.workshop.schemas import WorkshopFuelLineOut, WorkshopFuelOut, WorkshopSessionOut
from energetica.workshop.session import Investment

_BOTS = Path(__file__).resolve().parents[4] / "scripts" / "workshop_bots"
# The scripts import each other by bare name, so loading them adds these to `sys.modules`.
_SIBLINGS = ("api", "market", "strategies")


@pytest.fixture
def run(monkeypatch: pytest.MonkeyPatch) -> Iterator[ModuleType]:
    """``scripts/workshop_bots/run.py``, loaded with its folder on the import path, and unloaded afterwards."""
    monkeypatch.syspath_prepend(str(_BOTS))
    spec = importlib.util.spec_from_file_location("workshop_bots_run", _BOTS / "run.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    yield module
    for name in _SIBLINGS:
        sys.modules.pop(name, None)


class _FakeApi:
    """Stands in for the bot's ``Api``. Its fuel lines say the player burns coal only."""

    account_id = 1

    def __init__(self, username: str) -> None:
        self.username = username

    def fuel(self) -> WorkshopFuelOut:
        burned = {Fuel.COAL: True, Fuel.GAS: False, Fuel.URANIUM: False}
        lines = [
            WorkshopFuelLineOut.model_construct(fuel=fuel, burned=is_burned, season_need=1000.0, stock=0.0)
            for fuel, is_burned in burned.items()
        ]
        return WorkshopFuelOut.model_construct(procurement="manual", fuels=lines)

    def selection(self) -> Any:
        return SimpleNamespace(money=0.0)

    def fleet(self) -> list[Any]:
        return []

    def facilities(self) -> list[Any]:
        return []

    def loan(self) -> Any:
        return None


class _FakeHistory:
    def until(self, session: WorkshopSessionOut) -> list[Any]:
        return []


def test_bot_context_holds_only_the_fuels_its_facilities_burn(run: ModuleType, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(run, "Api", _FakeApi)
    strategy = run.Strategy()
    bot = run.Bot(strategy, live=False)

    ctx = bot.context(WorkshopSessionOut.model_construct(), Investment(round=1), _FakeHistory())

    assert set(ctx.fuel) == {Fuel.COAL}
    assert set(strategy.fuel_orders(ctx)) == {Fuel.COAL}
