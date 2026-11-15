"""
Importing a package must not load a package whose import has side effects it should not have.

Two packages do work just by being imported:

- ``energetica.freeplay`` builds the persistent world's game engine (#1055). The lower layers, the
  lobby, Workshop and the lobby service run without one, so none of them may load it.
- ``lobby_service`` loads the signing secret, and only the lobby service may hold it (ADR-0009). The
  runs and the lobby backend reach it through its API, so nothing in ``energetica`` may load it.

The import-linter contracts in ``backend/pyproject.toml`` already forbid these imports. What they cannot
see is what importing actually runs: an import made by name at run time
(``importlib.import_module``), or code in a package's ``__init__.py`` that a module runs just by
sitting beneath it. The lobby sits beneath ``energetica`` (#1058), so ``energetica/__init__.py``
runs whenever the lobby is imported. This test watches for those.

Import side effects can only be observed in a *fresh* interpreter, because the pytest process has
already imported the whole game app. So each check runs in a subprocess and inspects
``sys.modules``.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
# The probe runs from the repo root, as pytest does, so anything an import writes relative to the
# working directory lands where the rest of the suite's does.
_REPO_ROOT = _BACKEND_ROOT.parent

_ENGINE_PACKAGE = "energetica.freeplay"
_LOBBY_SERVICE_PACKAGE = "lobby_service"

# Imports a package and then each module beneath it, in a fresh interpreter, and prints the first
# module after which one of the forbidden packages is loaded, or null. The package is walked, so a
# new module is covered too.
_PROBE = """
import importlib, json, pkgutil, sys

package_name, forbidden = sys.argv[1], json.loads(sys.argv[2])

def modules(name):
    yield name
    package = importlib.import_module(name)
    for info in pkgutil.walk_packages(package.__path__, prefix=name + "."):
        yield info.name

culprit = None
for name in modules(package_name):
    importlib.import_module(name)
    loaded = sorted(f for f in forbidden if f in sys.modules)
    if loaded:
        culprit = [name, loaded]
        break
print(json.dumps(culprit))
"""


def _first_module_that_loads(package: str, forbidden: list[str]) -> tuple[str, list[str]] | None:
    # Import from this checkout's src/, as pytest itself does (`pythonpath` in pytest.ini).
    # Otherwise a git worktree's shared .venv would resolve `energetica` to the main checkout.
    env = {
        **os.environ,
        "PYTHONPATH": os.pathsep.join(filter(None, [str(_BACKEND_ROOT / "src"), os.environ.get("PYTHONPATH")])),
    }
    result = subprocess.run(
        [sys.executable, "-c", _PROBE, package, json.dumps(forbidden)],
        cwd=_REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        pytest.fail(f"importing {package} failed:\n{result.stderr}")
    culprit = json.loads(result.stdout.strip().splitlines()[-1])
    return None if culprit is None else (culprit[0], culprit[1])


@pytest.mark.parametrize(
    ("package", "forbidden"),
    [
        ("energetica.kernel", [_ENGINE_PACKAGE, _LOBBY_SERVICE_PACKAGE]),
        ("energetica.identity", [_ENGINE_PACKAGE, _LOBBY_SERVICE_PACKAGE]),
        ("energetica.sim", [_ENGINE_PACKAGE, _LOBBY_SERVICE_PACKAGE]),
        ("energetica.lobby", [_ENGINE_PACKAGE, _LOBBY_SERVICE_PACKAGE]),
        ("energetica.workshop", [_ENGINE_PACKAGE, _LOBBY_SERVICE_PACKAGE]),
        ("energetica.freeplay", [_LOBBY_SERVICE_PACKAGE]),
        ("lobby_service", [_ENGINE_PACKAGE]),
    ],
)
def test_importing_loads_no_package_it_must_not(package: str, forbidden: list[str]) -> None:
    culprit = _first_module_that_loads(package, forbidden)
    assert culprit is None, f"importing {culprit[0]} loaded {culprit[1]}"
