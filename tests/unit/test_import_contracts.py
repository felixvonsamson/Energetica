"""The import-linter contracts in ``pyproject.toml`` name the freeplay code in four places (#1051).

The freeplay code is not one package yet (#1057), so each contract lists ``energetica.freeplay``
and the top-level modules it still owns. The layers contract is exhaustive, so a new top-level
module must go into a layer. Nothing in import-linter makes it go into the per-app contracts too,
and a module missing from them could import Workshop or the lobby unchecked. This test keeps the
four lists the same.
"""

from __future__ import annotations

import tomllib
from pathlib import Path

_PYPROJECT = Path(__file__).resolve().parents[2] / "pyproject.toml"
_CONTRACTS = {c["name"]: c for c in tomllib.loads(_PYPROJECT.read_text())["tool"]["importlinter"]["contracts"]}

_LAYERS = "kernel, identity and sim are layered below the apps, and entry sits above them"
_WORKSHOP = "Workshop imports neither the lobby nor the freeplay code"
_LOBBY = "The lobby imports neither Workshop nor the freeplay code"
_FREEPLAY = "The freeplay code imports neither Workshop nor the lobby"


def _freeplay_code_in_the_layers_contract() -> set[str]:
    """The app layer of the layers contract, without Workshop, as full module names."""
    (container,) = _CONTRACTS[_LAYERS]["containers"]
    layers = [{tail.strip() for tail in layer.split(":")} for layer in _CONTRACTS[_LAYERS]["layers"]]
    app_layer = next(tails for tails in layers if "workshop" in tails)
    return {f"{container}.{tail}" for tail in app_layer - {"workshop"}}


def test_every_contract_names_the_same_freeplay_code() -> None:
    freeplay = _freeplay_code_in_the_layers_contract()
    assert set(_CONTRACTS[_FREEPLAY]["source_modules"]) == freeplay
    assert set(_CONTRACTS[_WORKSHOP]["forbidden_modules"]) == freeplay | {"lobby"}
    assert set(_CONTRACTS[_LOBBY]["forbidden_modules"]) == freeplay | {"energetica.entry", "energetica.workshop"}
