"""Unit tests for Workshop Run setup (#992 §11, #993, #1061): the shared-Network join and the
Workshop-specific player-identity object, in place of the persistent world's player-initiated
``join_network`` and tile-pick settle flow (``initialize_player``).
"""

from __future__ import annotations

import pytest

from energetica.identity.accounts import Account
from energetica.identity.instance_config import InstanceConfig
from energetica.workshop.network import WorkshopNetwork
from energetica.workshop.player import WORKSHOP_STARTING_BUDGET, WorkshopPlayer
from energetica.workshop.setup import NotAWorkshopRunError, join_workshop_run, open_workshop_run

# The persistent world's per-network cap (`energetica.config.constants`). Restated rather than
# imported: this module tests Workshop, which may not import from the persistent world.
PERSISTENT_NETWORK_MEMBER_LIMIT = 15

WORKSHOP_CONFIG = InstanceConfig.model_validate(
    {
        "name": "Workshop",
        "advertised": False,
        "starts_at": "2026-03-01T00:00:00Z",
        "run": {"mode": "workshop"},
    }
)

FREEPLAY_CONFIG = InstanceConfig.model_validate(
    {
        "name": "Persistent",
        "advertised": True,
        "starts_at": "2026-03-01T00:00:00Z",
        "access": {"policy": "public"},
        "run": {"mode": "freeplay"},
    }
)


def _account(account_id: int, username: str) -> Account:
    return Account(account_id=account_id, username=username, pwhash="hash", email=None, created_at="")


@pytest.fixture
def network() -> WorkshopNetwork:
    return open_workshop_run(WORKSHOP_CONFIG)


# --- the Run mode tag gates Workshop-specific behaviour --------------------------------------


def test_opening_rejects_a_freeplay_run() -> None:
    with pytest.raises(NotAWorkshopRunError):
        open_workshop_run(FREEPLAY_CONFIG)


def test_opening_a_workshop_run_gives_an_empty_shared_network() -> None:
    network = open_workshop_run(WORKSHOP_CONFIG)

    assert isinstance(network, WorkshopNetwork)
    assert network.players() == []


# --- shared Network -------------------------------------------------------------------------


def test_multiple_players_joining_land_in_the_same_network(network: WorkshopNetwork) -> None:
    alice = join_workshop_run(network, _account(1, "alice"))
    bob = join_workshop_run(network, _account(2, "bob"))

    assert alice.network is network
    assert bob.network is network
    assert network.players() == [alice, bob]


def test_joining_twice_with_the_same_account_returns_the_existing_player(network: WorkshopNetwork) -> None:
    """A retried join must not hand one account a second Run identity or a second shared-Network
    entry (review of #1048).
    """
    first = join_workshop_run(network, _account(1, "alice"))
    second = join_workshop_run(network, _account(1, "alice"))

    assert second is first
    assert network.players() == [first]


def test_joining_does_not_count_against_the_persistent_network_member_limit(network: WorkshopNetwork) -> None:
    """The persistent world's `join_network` caps membership per network. This is a separate,
    system-driven assignment path that the cap does not apply to (#990).
    """
    count = PERSISTENT_NETWORK_MEMBER_LIMIT + 5
    players = [join_workshop_run(network, _account(i, f"player{i}")) for i in range(count)]

    assert len(players) == count
    assert len(network.players()) == count


# --- player-identity object, not `Player` ---------------------------------------------------


def test_workshop_player_carries_account_linkage_and_starting_budget(network: WorkshopNetwork) -> None:
    player = join_workshop_run(network, _account(7, "carol"))

    assert isinstance(player, WorkshopPlayer)
    assert player.account_id == 7
    assert player.username == "carol"
    assert player.money == WORKSHOP_STARTING_BUDGET
    assert player.owned_facilities == []


def test_workshop_player_has_none_of_the_persistent_world_only_state(network: WorkshopNetwork) -> None:
    """The persistent-world-only pieces are dropped, not adapted (#992 §11): no tile (Workshop has
    no map), no `projects_by_priority`, no `achievements`.
    """
    player = join_workshop_run(network, _account(1, "alice"))

    assert not hasattr(player, "tile")
    assert not hasattr(player, "projects_by_priority")
    assert not hasattr(player, "achievements")


def test_player_repr_does_not_recurse_through_the_network(network: WorkshopNetwork) -> None:
    """The network holds each player, and each player holds the network back."""
    player = join_workshop_run(network, _account(1, "alice"))

    assert repr(player) == "<WorkshopPlayer 1 'alice'>"
