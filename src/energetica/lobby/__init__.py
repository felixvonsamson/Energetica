"""
The lobby backend: the server-wide front door (``lobby.{apex}``).

An instance-independent FastAPI app — signup, login, change-password, logout, and ``my-runs``. It
holds no database and no signing secret: it is a client of the lobby service
(:mod:`lobby_service`, ADR-0009), which checks credentials, mints sessions and owns memberships.
It is one of the three apps under ``energetica``, beside :mod:`energetica.freeplay` and
:mod:`energetica.workshop` (#1058). It builds on the identity layer and the kernel and imports
neither of the other apps, so it pulls in **none** of the game domain, routers, socketio or tick
loop (ADR-0002, lobby Phase B). The import contracts in ``pyproject.toml`` check what it imports,
and ``tests/unit/test_import_side_effects.py`` checks that importing it does not build the game
engine or load the lobby service.

Routes are mounted under ``/api/v1``. The lobby frontend's types
(``frontend/apps/lobby/src/types/api.generated.ts``) are generated from this app's schema.
"""

from __future__ import annotations

from energetica.lobby.app import create_lobby_app

__all__ = ["create_lobby_app"]
