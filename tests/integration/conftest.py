"""
Fixtures for every integration test.

Runs reach accounts, sessions and membership only through the lobby service (ADR-0009), so every
integration test gets a real one, called in-process over a fresh ``lobby.db``.
"""

from __future__ import annotations

import pytest

from energetica.identity.lobby_service_client import LobbyServiceClient


@pytest.fixture(autouse=True)
def _lobby_service_for_runs(lobby_service: LobbyServiceClient) -> None:
    """Wire the ``lobby_service`` fixture into every integration test, for the runs' sake."""
