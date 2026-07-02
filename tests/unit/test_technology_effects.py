"""Unit tests for technology_effects.py — knowledge spillover and energy invariant."""

import pytest

from energetica import create_app
from energetica.database.map.hex_tile import HexTile
from energetica.database.user import User
from energetica.enums import TechnologyType
from energetica.globals import engine
from energetica.technology_effects import (
    construction_power,
    construction_time,
    knowledge_spillover_discount,
)
from energetica.utils.auth import generate_password_hash
from energetica.utils.map_helpers import confirm_location


def test_knowledge_spillover_discount() -> None:
    """knowledge_spillover_discount is 0.98^n with no setup required."""
    assert knowledge_spillover_discount(0) == pytest.approx(1.0)
    assert knowledge_spillover_discount(1) == pytest.approx(0.98)
    assert knowledge_spillover_discount(5) == pytest.approx(0.98**5)


@pytest.mark.parametrize("n_researchers", [0, 1, 5])
def test_technology_total_energy_scales_with_spillover(n_researchers: int) -> None:
    """Total research energy equals base_energy × spillover_discount.

    construction_power already cancels the 1/f boost from the discounted
    construction_time, so power stays constant while the shorter duration
    reduces total energy by f = 0.98^n.
    """
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    user = User(username="username", pwhash=generate_password_hash("password"), role="player", account_id=1)
    player = confirm_location(user, HexTile.getitem(1))

    technology = TechnologyType.MATHEMATICS
    engine.technology_lvls[technology][0] = n_researchers

    base_energy = engine.const_config["assets"][technology]["base_construction_energy"]  # Wh
    f = knowledge_spillover_discount(n_researchers)

    ticks = construction_time(player, technology)
    power = construction_power(player, technology)  # W
    total_energy = power * ticks * engine.in_game_seconds_per_tick / 3600  # Wh

    assert total_energy == pytest.approx(base_energy * f, rel=1e-6)
