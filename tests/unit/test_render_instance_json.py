"""Tests for `scripts/infra/render-instance-json.sh`, which renders a new instance's `instance.json`.

`setup-instance.sh` writes whatever this script prints, and the backend fails closed on a file it
cannot parse, so a rendering the backend rejects locks every player out of the new Run. These tests
run the script for real (it needs only bash and sed, not root) and parse its output with the same
model the login path uses.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from energetica.identity import instance_config
from energetica.identity.instance_config import InstanceConfig, PrivateAccess, PublicAccess

_RENDERER = Path(__file__).resolve().parents[2] / "scripts" / "infra" / "render-instance-json.sh"


@pytest.fixture
def modes_file(tmp_path: Path) -> Path:
    """The file `push-bootstrap.sh` writes to the server, generated the same way."""
    path = tmp_path / "run-modes"
    path.write_text("\n".join(instance_config.run_modes()) + "\n", encoding="utf-8")
    return path


def _render(modes_file: Path, *extra: str, mode: str | None = "freeplay") -> subprocess.CompletedProcess[str]:
    args = ["bash", str(_RENDERER), "--modes-file", str(modes_file), "--name", "Autumn 2025"]
    args += ["--advertised", "true", "--starts-at", "2025-09-15T00:00:00Z"]
    if mode is not None:
        args += ["--mode", mode]
    return subprocess.run([*args, *extra], capture_output=True, text=True, check=False)


def _rendered_config(modes_file: Path, *extra: str, mode: str = "freeplay") -> InstanceConfig:
    result = _render(modes_file, *extra, mode=mode)
    assert result.returncode == 0, result.stderr
    assert "@" not in result.stdout, f"unsubstituted placeholder in:\n{result.stdout}"
    return InstanceConfig.model_validate_json(result.stdout)


@pytest.mark.parametrize("mode", instance_config.run_modes())
def test_every_mode_renders_a_file_the_backend_accepts(modes_file: Path, mode: str) -> None:
    config = _rendered_config(modes_file, mode=mode)
    assert config.run.mode == mode


def test_a_freeplay_run_renders_public(modes_file: Path) -> None:
    assert _rendered_config(modes_file, mode="freeplay").access == PublicAccess(policy="public")


def test_a_workshop_run_renders_the_access_the_backend_defaults_it_to(modes_file: Path) -> None:
    """The file is rendered with an explicit block so an admin can read it, and that block must be
    what the backend would have filled in had it been left out.
    """
    rendered = _rendered_config(modes_file, mode="workshop")
    without_access = rendered.model_dump(mode="json", exclude={"access"})
    assert rendered.access == InstanceConfig.model_validate(without_access).access == PrivateAccess(policy="private")


def test_lifecycle_boundaries_render_null_when_omitted(modes_file: Path) -> None:
    config = _rendered_config(modes_file)
    assert config.freeze_at is None and config.ended_at is None


def test_lifecycle_boundaries_render_when_given(modes_file: Path) -> None:
    config = _rendered_config(modes_file, "--freeze-at", "2025-12-01T00:00:00Z", "--ended-at", "2025-12-08T00:00:00Z")
    assert config.freeze_at is not None and config.freeze_at.isoformat() == "2025-12-01T00:00:00+00:00"
    assert config.ended_at is not None and config.ended_at.isoformat() == "2025-12-08T00:00:00+00:00"


def test_sed_metacharacters_in_the_name_survive(modes_file: Path) -> None:
    config = _rendered_config(modes_file, "--name", "R&D / Q1")
    assert config.name == "R&D / Q1"


def test_the_rendered_file_is_plain_json(modes_file: Path) -> None:
    result = _render(modes_file)
    assert json.loads(result.stdout)["run"] == {"mode": "freeplay"}


@pytest.mark.parametrize(
    "extra",
    [
        pytest.param(("--name", 'Say "hi"'), id="quote-in-name"),
        pytest.param(("--name", "back\\slash"), id="backslash-in-name"),
        pytest.param(("--starts-at", '2025"'), id="quote-in-starts-at"),
        pytest.param(("--advertised", "yes"), id="non-boolean-advertised"),
    ],
)
def test_input_that_would_break_the_json_is_refused(modes_file: Path, extra: tuple[str, ...]) -> None:
    result = _render(modes_file, *extra)
    assert result.returncode != 0
    assert result.stdout == ""


def test_the_mode_is_required(modes_file: Path) -> None:
    result = _render(modes_file, mode=None)
    assert result.returncode != 0
    assert "--mode" in result.stderr


def test_a_mode_the_backend_does_not_accept_is_refused(modes_file: Path) -> None:
    result = _render(modes_file, mode="tournament")
    assert result.returncode != 0
    assert "tournament" in result.stderr
    assert "freeplay" in result.stderr and "workshop" in result.stderr


def test_a_missing_modes_file_points_at_push_bootstrap(tmp_path: Path) -> None:
    result = _render(tmp_path / "absent")
    assert result.returncode != 0
    assert "push-bootstrap.sh" in result.stderr
