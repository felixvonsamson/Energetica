"""Settling joins the account to the run through the lobby service (ADR-0009).

Creating a ``Player`` is what makes a public run appear under the account's "your runs", so settle
calls the lobby service's idempotent join before it touches the engine.
"""

from __future__ import annotations

import pytest

from energetica.freeplay.app import create_app
from energetica.freeplay.database.map.hex_tile import HexTile
from energetica.freeplay.database.player import Player
from energetica.identity.account import Account
from energetica.identity.lobby_service_client import LobbyServiceClient, LobbyServiceUnavailable
from energetica.utils.map_helpers import confirm_location


def test_settling_joins_the_account_to_this_run(
    lobby_service: LobbyServiceClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", "spring-2026")
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    created = lobby_service.create_account(username="alice", password="correct-password")

    confirm_location(Account(account_id=created.account_id, username="alice"), HexTile.getitem(1))

    assert [run.slug for run in lobby_service.get_memberships(created.account_id).runs] == ["spring-2026"]


def test_settling_an_account_that_already_joined_keeps_its_one_membership(
    lobby_service: LobbyServiceClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", "spring-2026")
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    created = lobby_service.create_account(username="alice", password="correct-password")
    lobby_service.add_run_member("spring-2026", created.account_id)
    joined_at = lobby_service.get_memberships(created.account_id).runs[0].joined_at

    confirm_location(Account(account_id=created.account_id, username="alice"), HexTile.getitem(1))

    runs = lobby_service.get_memberships(created.account_id).runs
    assert [(run.slug, run.joined_at) for run in runs] == [("spring-2026", joined_at)]


def test_settle_aborts_before_any_engine_mutation_when_the_lobby_service_fails(
    lobby_service: LobbyServiceClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The join happens before any engine mutation (tile claim, Player creation, chat join), so a
    failure leaves nothing to undo and no in-engine player without a membership. The client gets
    a 503 and can safely retry, since the tile is still unclaimed.
    """
    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", "spring-2026")
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")

    def unavailable(slug: str, account_id: int) -> None:
        raise LobbyServiceUnavailable("test")

    monkeypatch.setattr(lobby_service, "add_run_member", unavailable)
    tile = HexTile.getitem(1)

    with pytest.raises(LobbyServiceUnavailable):
        confirm_location(Account(account_id=9, username="carol"), tile)

    assert tile.player is None
    assert next(Player.filter_by(account_id=9), None) is None


def test_settling_calls_no_lobby_service_when_slug_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    """In dev / unconfigured deployments there is no slug and no lobby, so settle must not need one.

    No ``lobby_service`` fixture here: any call would try the real socket and fail.
    """
    monkeypatch.delenv("ENERGETICA_INSTANCE_SLUG", raising=False)
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")

    player = confirm_location(Account(account_id=8, username="bob"), HexTile.getitem(1))

    assert player.account_id == 8
