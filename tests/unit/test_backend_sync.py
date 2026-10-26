"""
Tests for `scripts/lib/backend-sync.sh`, which ships the backend to an instance or the lobby.

Both deploy scripts used to rsync the whole working tree minus an exclude list, so anything else
in the deployer's checkout reached the server, untracked files included (#1363). The helper now
ships an allowlist: the entry points the systemd units run, and the wheel the install step reads.

These tests run the helper for real against a local directory standing in for the server. The
helper finds the repo root from its own location, so each test copies it into a scratch repo
that holds the junk a real checkout accumulates.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

# The helper shells out to rsync, which is a deploy prerequisite rather than a Python dependency.
pytestmark = pytest.mark.skipif(shutil.which("rsync") is None, reason="rsync is not installed")

_HELPER = Path(__file__).resolve().parents[2] / "scripts" / "lib" / "backend-sync.sh"
_WHEEL = "energetica-1.0-py3-none-any.whl"

# What the server owns, or what another step of the same deploy syncs. The sync must keep these.
_SERVER_OWNED = [
    "instance/x",
    "checkpoints/x",
    ".venv/x",
    "scripts/x",
    ".well-known/acme-challenge/x",
    "DEPLOYED_VERSION.json",
]

# What a previous deploy, or an older deploy script, left behind. The sync must delete these.
_STRAY = ["src/energetica/x.py", "docs/x.md", ".claude/worktrees/x/main.py", "admin_accounts.txt"]


def _touch(root: Path, relative: str) -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(relative)


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A checkout with the entry points, a built wheel, a stale wheel and untracked junk."""
    root = tmp_path / "repo"
    (root / "scripts" / "lib").mkdir(parents=True)
    shutil.copy(_HELPER, root / "scripts" / "lib" / _HELPER.name)
    for relative in [
        "main.py",
        "main_lobby.py",
        "main_lobby_service.py",
        f"dist/{_WHEEL}",
        "dist/energetica-0.9-py3-none-any.whl",
        "src/energetica/__init__.py",
        "junk.txt",
        ".claude/worktrees/x/main.py",
        ".claude/settings.local.json",
        "frontend/dist-app/index.html",
    ]:
        _touch(root, relative)
    return root


def _sync(
    repo: Path, target: Path, bundle_dir: str, *entry_points: str, umask: str = "022", wheel: str = _WHEEL
) -> subprocess.CompletedProcess[str]:
    script = f"""
        set -euo pipefail
        umask {umask}
        log_step() {{ :; }}; log_success() {{ :; }}; log_error() {{ echo "$1" >&2; }}
        source "{repo}/scripts/lib/backend-sync.sh"
        BACKEND_WHEEL="{wheel}"
        sync_backend "$@"
    """
    return subprocess.run(
        ["bash", "-c", script, "bash", str(target), bundle_dir, *entry_points],
        capture_output=True,
        text=True,
        check=False,
    )


def _files(root: Path) -> set[str]:
    return {str(path.relative_to(root)) for path in root.rglob("*") if path.is_file()}


@pytest.mark.parametrize(
    ("bundle_dir", "entry_points"),
    [("dist-app", ["main.py"]), ("dist-lobby", ["main_lobby.py", "main_lobby_service.py"])],
)
def test_ships_only_the_entry_points_and_the_wheel(
    repo: Path, tmp_path: Path, bundle_dir: str, entry_points: list[str]
) -> None:
    target = tmp_path / "server"
    target.mkdir()

    result = _sync(repo, target, bundle_dir, *entry_points)

    assert result.returncode == 0, result.stderr
    assert _files(target) == {*entry_points, f"dist/{_WHEEL}"}


@pytest.mark.parametrize("bundle_dir", ["dist-app", "dist-lobby"])
def test_deletes_stray_files_and_keeps_what_the_server_owns(repo: Path, tmp_path: Path, bundle_dir: str) -> None:
    target = tmp_path / "server"
    for relative in [*_SERVER_OWNED, f"{bundle_dir}/x", *_STRAY, "dist/energetica-0.9-py3-none-any.whl"]:
        _touch(target, relative)

    result = _sync(repo, target, bundle_dir, "main.py")

    assert result.returncode == 0, result.stderr
    assert _files(target) == {*_SERVER_OWNED, f"{bundle_dir}/x", "main.py", f"dist/{_WHEEL}"}
    # The server-owned files are untouched, not just present.
    assert (target / "instance" / "x").read_text() == "instance/x"


def test_shipped_files_stay_readable_by_the_group_under_a_restrictive_umask(repo: Path, tmp_path: Path) -> None:
    """
    The service user reaches the code through the `energetica` group only, so a deployer whose
    umask is 077 must not ship files that group cannot read. The target root itself gets the mode
    a default checkout gave it before, so Apache can still reach the bundle beneath it.
    """
    (repo / "main.py").chmod(0o600)
    (repo / "dist" / _WHEEL).chmod(0o600)
    target = tmp_path / "server"
    target.mkdir()

    result = _sync(repo, target, "dist-app", "main.py", umask="077")

    assert result.returncode == 0, result.stderr
    expected = {".": 0o755, "dist": 0o755, "main.py": 0o644, f"dist/{_WHEEL}": 0o644}
    assert {relative: (target / relative).stat().st_mode & 0o777 for relative in expected} == expected


def test_refuses_to_sync_before_the_wheel_is_built(repo: Path, tmp_path: Path) -> None:
    target = tmp_path / "server"
    _touch(target, "src/energetica/x.py")

    result = _sync(repo, target, "dist-app", "main.py", wheel="")

    assert result.returncode == 1
    assert "before build_backend_wheel" in result.stderr
    assert _files(target) == {"src/energetica/x.py"}
