"""The lobby is an instance-independent service: it reuses the server-wide identity layer
(``energetica.identity``) and the signing primitives, but must be able to import them **without
dragging in the game domain or its running services** (ADR-0002, lobby Phase B).
``energetica.kernel.session`` is a game-model-free leaf, and the heavy game graph (routers,
socketio, tick loop, domain models) is imported lazily inside ``create_app`` rather than at
``energetica`` import.

A *dormant* ``GameEngine`` object is still constructed at import (it is light and the ORM binds it
at model-definition time), so ``energetica.game_engine`` itself is deliberately **not** a leak
marker — what must stay out is the domain graph, socketio and the tick loop. The ``energetica``
package itself builds that dormant object, so it moves out with the engine in #1055.

Import side effects can only be observed in a *fresh* interpreter — the pytest process has already
imported the whole game app — so each check runs in a subprocess and inspects ``sys.modules``.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

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
    # Import from this checkout's src/, as pytest itself does (`pythonpath` in pyproject.toml).
    # Otherwise a git worktree's shared .venv would resolve `energetica` to the main checkout.
    env = {
        **os.environ,
        "PYTHONPATH": os.pathsep.join(filter(None, [str(_REPO_ROOT / "src"), os.environ.get("PYTHONPATH")])),
    }
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=_REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    import json

    return set(json.loads(result.stdout.strip().splitlines()[-1]))


def test_importing_accounts_does_not_load_the_game_engine() -> None:
    loaded = _modules_after_importing("energetica.identity.accounts")
    leaked = loaded.intersection(_ENGINE_MARKERS)
    assert not leaked, f"importing energetica.identity.accounts leaked the game engine: {sorted(leaked)}"


def test_importing_session_leaf_does_not_load_the_game_engine() -> None:
    loaded = _modules_after_importing("energetica.kernel.session")
    leaked = loaded.intersection(_ENGINE_MARKERS)
    assert not leaked, f"importing energetica.kernel.session leaked the game engine: {sorted(leaked)}"


def test_importing_instance_config_does_not_load_the_game_engine() -> None:
    loaded = _modules_after_importing("energetica.identity.instance_config")
    leaked = loaded.intersection(_ENGINE_MARKERS)
    assert not leaked, f"importing energetica.identity.instance_config leaked the game engine: {sorted(leaked)}"


def test_importing_the_lobby_service_does_not_load_the_game_engine() -> None:
    """The whole point: the lobby app imports with none of the game domain or its services."""
    loaded = _modules_after_importing("lobby")
    leaked = loaded.intersection(_ENGINE_MARKERS)
    assert not leaked, f"importing the lobby service leaked the game engine: {sorted(leaked)}"


@pytest.mark.parametrize("module", ["energetica.identity.server_config", "energetica.identity.my_runs"])
def test_importing_the_rest_of_the_identity_layer_does_not_load_the_game_engine(module: str) -> None:
    loaded = _modules_after_importing(module)
    leaked = loaded.intersection(_ENGINE_MARKERS)
    assert not leaked, f"importing {module} leaked the game engine: {sorted(leaked)}"
