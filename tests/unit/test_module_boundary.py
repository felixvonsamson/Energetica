"""The lobby is an instance-independent service: it reuses the server-wide identity layer
(``energetica.accounts`` / ``energetica.instance_config`` / the signing primitives) but must be
able to import it **without dragging in the game domain or its running services** (ADR-0002, lobby
Phase B). ``energetica.utils.session`` is a game-model-free leaf, and the heavy game graph
(routers, socketio, tick loop, domain models) is imported lazily inside ``create_app`` rather than
at ``energetica`` import.

A *dormant* ``GameEngine`` object is still constructed at import (it is light and the ORM binds it
at model-definition time), so ``energetica.game_engine`` itself is deliberately **not** a leak
marker — what must stay out is the domain graph, socketio and the tick loop. The final severing of
that dormant object is the follow-up identity-package extraction.

Import side effects can only be observed in a *fresh* interpreter — the pytest process has already
imported the whole game app — so each check runs in a subprocess and inspects ``sys.modules``.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]

# Modules whose presence after importing the identity layer means the heavy game graph / a running
# service has leaked in: the domain models, the router package, the socketio server, the tick loop.
_ENGINE_MARKERS = (
    "energetica.database.player",
    "energetica.routers",
    "energetica.socketio",
    "energetica.utils.tick_execution",
)


def _modules_after_importing(module: str) -> set[str]:
    """Import ``module`` in a clean interpreter and return the ``energetica.*`` modules it loaded."""
    code = (
        f"import {module}, sys, json\nprint(json.dumps(sorted(m for m in sys.modules if m.startswith('energetica'))))\n"
    )
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=_REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    import json

    return set(json.loads(result.stdout.strip().splitlines()[-1]))


def test_importing_accounts_does_not_load_the_game_engine() -> None:
    loaded = _modules_after_importing("energetica.accounts")
    leaked = loaded.intersection(_ENGINE_MARKERS)
    assert not leaked, f"importing energetica.accounts leaked the game engine: {sorted(leaked)}"


def test_importing_session_leaf_does_not_load_the_game_engine() -> None:
    loaded = _modules_after_importing("energetica.utils.session")
    leaked = loaded.intersection(_ENGINE_MARKERS)
    assert not leaked, f"importing energetica.utils.session leaked the game engine: {sorted(leaked)}"


def test_importing_instance_config_does_not_load_the_game_engine() -> None:
    loaded = _modules_after_importing("energetica.instance_config")
    leaked = loaded.intersection(_ENGINE_MARKERS)
    assert not leaked, f"importing energetica.instance_config leaked the game engine: {sorted(leaked)}"


def test_importing_the_lobby_service_does_not_load_the_game_engine() -> None:
    """The whole point: the lobby app imports with none of the game domain or its services."""
    loaded = _modules_after_importing("lobby")
    leaked = loaded.intersection(_ENGINE_MARKERS)
    assert not leaked, f"importing the lobby service leaked the game engine: {sorted(leaked)}"
