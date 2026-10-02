"""The lobby is an instance-independent service: it reuses the server-wide identity layer
(``energetica.identity``) and the signing primitives, but must be able to import them **without
dragging in the game domain or its running services** (ADR-0002, lobby Phase B).
``energetica.kernel.session`` is a game-model-free leaf, and the heavy game graph (routers,
socketio, tick loop, domain models) is imported lazily inside ``create_app`` rather than at
``energetica`` import.

The persistent world's game engine is built when ``energetica.freeplay`` is imported, not when
``energetica`` is (#1055). So ``energetica.freeplay`` itself is a leak marker: if it is loaded, the
engine was constructed. The same check covers the shared simulation layer, which must not reach
into any mode's package either.

Import side effects can only be observed in a *fresh* interpreter — the pytest process has already
imported the whole game app — so each check runs in a subprocess and inspects ``sys.modules``.
"""

from __future__ import annotations

import ast
import os
import pkgutil
import subprocess
import sys
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[2]

# Modules whose presence after importing a lower layer or the lobby means the heavy game graph / a running
# service has leaked in: the persistent world's package (which builds the engine), the domain models,
# the router package, the socketio server, the tick loop.
_ENGINE_MARKERS = (
    "energetica.freeplay",
    "energetica.freeplay.database.player",
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


def test_importing_the_error_envelope_does_not_load_the_game_engine() -> None:
    loaded = _modules_after_importing("energetica.kernel.error_envelope")
    leaked = loaded.intersection(_ENGINE_MARKERS)
    assert not leaked, f"importing energetica.kernel.error_envelope leaked the game engine: {sorted(leaked)}"


def test_importing_instance_config_does_not_load_the_game_engine() -> None:
    loaded = _modules_after_importing("energetica.identity.instance_config")
    leaked = loaded.intersection(_ENGINE_MARKERS)
    assert not leaked, f"importing energetica.identity.instance_config leaked the game engine: {sorted(leaked)}"


def test_importing_the_lobby_service_does_not_load_the_game_engine() -> None:
    """The whole point: the lobby app imports with none of the game domain or its services."""
    loaded = _modules_after_importing("lobby")
    leaked = loaded.intersection(_ENGINE_MARKERS)
    assert not leaked, f"importing the lobby service leaked the game engine: {sorted(leaked)}"


@pytest.mark.parametrize(
    "module",
    [
        "energetica.identity.server_config",
        "energetica.identity.my_runs",
        "energetica.identity.web",
        "energetica.identity.schemas.auth",
    ],
)
def test_importing_the_rest_of_the_identity_layer_does_not_load_the_game_engine(module: str) -> None:
    loaded = _modules_after_importing(module)
    leaked = loaded.intersection(_ENGINE_MARKERS)
    assert not leaked, f"importing {module} leaked the game engine: {sorted(leaked)}"


# Every module in the simulation layer, found from the package so a new module is covered too.
_SIM_MODULES = sorted(
    f"energetica.sim.{m.name}" for m in pkgutil.iter_modules([str(_REPO_ROOT / "src/energetica/sim")])
)


@pytest.mark.parametrize("module", _SIM_MODULES)
def test_importing_the_simulation_layer_does_not_load_the_game_engine(module: str) -> None:
    loaded = _modules_after_importing(module)
    leaked = loaded.intersection(_ENGINE_MARKERS)
    assert not leaked, f"importing {module} leaked the game engine: {sorted(leaked)}"


# The layers Workshop may import from (#1049), plus its own package.
_WORKSHOP_ALLOWED_PREFIXES = ("energetica.kernel", "energetica.identity", "energetica.sim", "energetica.workshop")


def _energetica_imports(path: Path, module: str) -> set[str]:
    """Every ``energetica`` module that the source file at ``path`` (module ``module``) names in an import.

    Read from the syntax tree rather than by importing, so imports inside ``if TYPE_CHECKING:``
    blocks and function bodies count too. Relative imports are resolved against ``module``.
    """
    package = module if path.name == "__init__.py" else module.rpartition(".")[0]
    found: set[str] = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            if node.level == 0:
                found.add(node.module or "")
            else:
                base = package.rsplit(".", node.level - 1)[0] if node.level > 1 else package
                found.add(f"{base}.{node.module}" if node.module else base)
    return {name for name in found if name == "energetica" or name.startswith("energetica.")}


def _within(module: str, prefixes: tuple[str, ...]) -> bool:
    return any(module == prefix or module.startswith(f"{prefix}.") for prefix in prefixes)


# Every source file in the Workshop package, subpackages included, so a new module is covered too.
_WORKSHOP_FILES = sorted((_REPO_ROOT / "src/energetica/workshop").rglob("*.py"))


def _module_name(path: Path) -> str:
    parts = path.relative_to(_REPO_ROOT / "src").with_suffix("").parts
    return ".".join(parts[:-1] if parts[-1] == "__init__" else parts)


@pytest.mark.parametrize("path", _WORKSHOP_FILES, ids=_module_name)
def test_workshop_imports_only_from_the_layers_below_it(path: Path) -> None:
    """Workshop is an application package. It builds on ``kernel``, ``identity`` and ``sim`` and on
    nothing else, so it cannot pick up the persistent world's engine or model store by accident (#1061).

    Unlike the checks above, this one is about which modules Workshop names, not what importing it
    runs, so it reads the source instead of importing it in a subprocess.
    """
    module = _module_name(path)
    outside = sorted(m for m in _energetica_imports(path, module) if not _within(m, _WORKSHOP_ALLOWED_PREFIXES))
    assert not outside, f"{module} imports from outside kernel, identity and sim: {outside}"
