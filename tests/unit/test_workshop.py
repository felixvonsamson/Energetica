"""Unit tests for Workshop Run setup (#992 §11, #993): the shared-Network join and the
Workshop-specific player-identity object, in place of the persistent world's player-initiated
``join_network`` and tile-pick settle flow (``initialize_player``).
"""

from __future__ import annotations

import pytest

from energetica import create_app
from energetica.accounts import Account
from energetica.config.constants import NETWORK_MEMBER_LIMIT, WORKSHOP_STARTING_BUDGET
from energetica.instance_config import InstanceConfig, WorkshopConfig
from energetica.workshop.network import WorkshopNetwork, get_or_create_shared_network
from energetica.workshop.player import WorkshopPlayer
from energetica.workshop.setup import NotAWorkshopRunError, join_workshop_run

WORKSHOP_CONFIG = InstanceConfig.model_validate(
    {
        "name": "Workshop",
        "advertised": False,
        "starts_at": "2026-03-01T00:00:00Z",
        "workshop": {},
    }
)

PERSISTENT_CONFIG = InstanceConfig.model_validate(
    {
        "name": "Persistent",
        "advertised": True,
        "starts_at": "2026-03-01T00:00:00Z",
        "access": {"policy": "public"},
    }
)


def _account(account_id: int, username: str) -> Account:
    return Account(account_id=account_id, username=username, pwhash="hash", email=None, created_at="")


@pytest.fixture(autouse=True)
def _fresh_engine_db() -> None:
    """Every test starts with a clean DBModel registry — WorkshopPlayer/WorkshopNetwork included,
    since ``clear_db`` resets every ``DBModel`` subclass — matching the rest of the test suite's
    convention (see e.g. tests/unit/test_player.py).
    """
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")


# --- config.workshop is not None gates Workshop-specific behavior ----------------------------


def test_join_rejects_a_non_workshop_run() -> None:
    with pytest.raises(NotAWorkshopRunError):
        join_workshop_run(_account(1, "alice"), PERSISTENT_CONFIG)


def test_join_accepts_a_workshop_run() -> None:
    player = join_workshop_run(_account(1, "alice"), WORKSHOP_CONFIG)
    assert isinstance(player, WorkshopPlayer)


def test_joining_twice_with_the_same_account_returns_the_existing_player() -> None:
    """A retried join must not hand one account a second Run identity or a second shared-Network
    entry (greptile review on #1048).
    """
    first = join_workshop_run(_account(1, "alice"), WORKSHOP_CONFIG)
    second = join_workshop_run(_account(1, "alice"), WORKSHOP_CONFIG)

    assert second is first
    assert len(WorkshopPlayer.all()) == 1
    assert first.network is not None
    assert first.network.members == [first]


# --- shared Network -----------------------------------------------------------------------


def test_multiple_players_joining_land_in_the_same_network() -> None:
    alice = join_workshop_run(_account(1, "alice"), WORKSHOP_CONFIG)
    bob = join_workshop_run(_account(2, "bob"), WORKSHOP_CONFIG)

    assert alice.network is not None
    assert alice.network is bob.network
    assert alice.network.members == [alice, bob]


def test_get_or_create_shared_network_is_idempotent() -> None:
    first = get_or_create_shared_network()
    second = get_or_create_shared_network()
    assert first is second
    assert len(WorkshopNetwork.all()) == 1


def test_joining_does_not_count_against_network_member_limit() -> None:
    """The persistent world's `join_network` caps membership at `NETWORK_MEMBER_LIMIT` — this is
    a distinct, system-driven assignment path that isn't subject to that cap at all (#990).
    """
    players = [join_workshop_run(_account(i, f"player{i}"), WORKSHOP_CONFIG) for i in range(NETWORK_MEMBER_LIMIT + 5)]

    assert len(players) == NETWORK_MEMBER_LIMIT + 5
    network = players[0].network
    assert network is not None
    assert len(network.members) == NETWORK_MEMBER_LIMIT + 5


# --- player-identity object, not `Player` ---------------------------------------------------


def test_joining_creates_a_workshop_player_not_a_persistent_player() -> None:
    from energetica.database.player import Player

    player = join_workshop_run(_account(1, "alice"), WORKSHOP_CONFIG)

    assert isinstance(player, WorkshopPlayer)
    assert not isinstance(player, Player)
    # Never went through the tile-pick settle flow: there is no tile system in Workshop at all.
    assert not hasattr(player, "tile")


def test_workshop_player_carries_account_linkage_and_starting_budget() -> None:
    player = join_workshop_run(_account(7, "carol"), WORKSHOP_CONFIG)

    assert player.account_id == 7
    assert player.username == "carol"
    assert player.money == WORKSHOP_STARTING_BUDGET
    assert player.owned_facilities == []
    assert player.is_in_network is True


def test_workshop_config_has_no_per_player_tech_tree_or_achievements() -> None:
    """The persistent-world-only pieces are dropped, not adapted (#992 §11): no
    `projects_by_priority`, no `achievements`.
    """
    player = join_workshop_run(_account(1, "alice"), WORKSHOP_CONFIG)

    assert not hasattr(player, "projects_by_priority")
    assert not hasattr(player, "achievements")


def test_workshop_config_type_is_the_discriminator() -> None:
    assert isinstance(WORKSHOP_CONFIG.workshop, WorkshopConfig)
    assert PERSISTENT_CONFIG.workshop is None
