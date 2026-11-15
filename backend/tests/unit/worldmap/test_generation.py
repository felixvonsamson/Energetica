"""
The world-map generator, called in-process as a server would call it.

The pinned map in ``map_seed_0.csv`` is what the generator produced for seed 0 before it moved into
the package (#1112), so the move is checked against the old code's output rather than the new code's.
"""

from __future__ import annotations

import csv
import os
import random
import subprocess
import sys
from dataclasses import asdict
from pathlib import Path

import pytest

from energetica.worldmap.generation import generate_map, write_csv

_PINNED_MAP = Path(__file__).with_name("map_seed_0.csv")
_SHIPPED_MAP = Path(__file__).resolve().parents[3] / "src" / "energetica" / "freeplay" / "data" / "map.csv"
_BACKEND_SRC = Path(__file__).resolve().parents[3] / "src"


def _read_rows(path: Path) -> list[dict[str, float]]:
    with path.open(encoding="utf-8") as file:
        return [{column: float(value) for column, value in row.items()} for row in csv.DictReader(file)]


def test_seed_0_reproduces_the_pinned_map() -> None:
    tiles = generate_map(random.Random(0))

    expected = _read_rows(_PINNED_MAP)
    assert len(tiles) == len(expected)
    for tile, row in zip(tiles, expected, strict=True):
        # A relative tolerance rather than exact equality: the solar column comes from numpy's
        # trigonometry, whose last bit can differ between CPUs.
        assert asdict(tile) == pytest.approx(row, rel=1e-9)


def test_generating_leaves_the_global_random_state_alone() -> None:
    state = random.getstate()

    generate_map(random.Random(0))

    assert random.getstate() == state


def test_generating_writes_no_files(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)

    generate_map(random.Random(0))

    assert list(tmp_path.iterdir()) == []


def test_importing_the_generator_writes_no_files(tmp_path: Path) -> None:
    # The generator used to build ten maps and write them to the working directory on import, so
    # import it in a fresh interpreter, from an empty directory.
    env = {**os.environ, "PYTHONPATH": str(_BACKEND_SRC)}
    subprocess.run([sys.executable, "-c", "import energetica.worldmap.generation"], cwd=tmp_path, env=env, check=True)

    assert list(tmp_path.iterdir()) == []


def test_written_csv_has_the_columns_the_game_reads(tmp_path: Path) -> None:
    path = tmp_path / "map.csv"

    write_csv(generate_map(random.Random(0)), path)

    with path.open(encoding="utf-8") as written, _SHIPPED_MAP.open(encoding="utf-8") as shipped:
        assert written.readline() == shipped.readline()


def test_written_csv_reads_back_as_the_generated_map(tmp_path: Path) -> None:
    tiles = generate_map(random.Random(0))
    path = tmp_path / "map.csv"

    write_csv(tiles, path)

    assert _read_rows(path) == [asdict(tile) for tile in tiles]
