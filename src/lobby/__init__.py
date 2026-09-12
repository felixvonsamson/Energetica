"""The lobby service: the server-wide front door (``lobby.{apex}``).

An instance-independent FastAPI app — signup, login, change-password, logout, and ``my-runs`` —
that owns credentials and the server-wide session. It reuses the server-wide identity layer
(``energetica.accounts`` / ``instance_config`` / the ``energetica.utils.session`` signing
primitives) but pulls in **none** of the game domain, routers, socketio or tick loop (ADR-0002,
lobby Phase B); the guard is ``tests/unit/test_module_boundary.py``.

Routes are mounted under ``/api/v1`` and reuse the game's request schemas so the frontend's
generated types (``api.generated.ts``, produced from the game app) cover the lobby too.
"""

from __future__ import annotations

from lobby.app import create_lobby_app

__all__ = ["create_lobby_app"]
