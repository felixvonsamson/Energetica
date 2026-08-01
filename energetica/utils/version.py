"""Report the deployed version of each half of the app for ``/healthz``.

The backend and the frontend are shipped by different deploy steps and can drift apart
(a frontend-only redeploy from a dirty tree against an unchanged backend is routine), so
each half is stamped separately:

- **backend** — ``scripts/deploy-*.sh`` write ``DEPLOYED_VERSION.json`` at the repo root on
  the server at rsync time. The deploy machine has a git checkout; the server does not
  (deploys rsync with ``--exclude='.git'``), so the commit must be captured before shipping.
- **frontend** — the vite build writes ``build-info.json`` into the bundle it emits
  (``energetica/static/app`` for an instance, ``dist-lobby`` for the lobby), and it rsyncs
  to the server with the rest of the bundle.

In local dev neither file exists, so the backend half falls back to reading git directly.
Everything here fails soft: an unreadable or absent stamp yields ``None``, never an
exception — ``/healthz`` must answer even when the version is unknown.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

# energetica/utils/version.py -> energetica/utils -> energetica -> repo root. On the server the
# "repo root" is the instance dir (e.g. /var/www/energetica-hertz), which is where the deploy
# script writes DEPLOYED_VERSION.json and under which the frontend bundles live.
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_BACKEND_STAMP = REPO_ROOT / "DEPLOYED_VERSION.json"


def _read_json(path: Path) -> dict | None:
    try:
        data = json.loads(path.read_text())
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def _git(*args: str) -> str | None:
    try:
        out = subprocess.check_output(["git", *args], cwd=REPO_ROOT, stderr=subprocess.DEVNULL)
    except (subprocess.CalledProcessError, FileNotFoundError, OSError):
        return None
    return out.decode().strip()


def _git_fallback() -> dict | None:
    """Read the version straight from git — the local-dev path, where a checkout exists."""
    commit = _git("rev-parse", "HEAD")
    if commit is None:
        return None
    porcelain = _git("status", "--porcelain")
    return {
        "commit": commit,
        "commit_short": commit[:9],
        "branch": _git("rev-parse", "--abbrev-ref", "HEAD"),
        # None (not False) when git could not be queried, so "clean" and "unknown" stay distinct.
        "dirty": None if porcelain is None else bool(porcelain),
        "source": "git",
    }


def backend_version() -> dict | None:
    """The deployed backend version: the deploy stamp if present, else git (local dev)."""
    return _read_json(_BACKEND_STAMP) or _git_fallback()


def frontend_version(bundle_subpath: str) -> dict | None:
    """The built frontend version stamped into ``{bundle_subpath}/build-info.json``.

    ``bundle_subpath`` is relative to the repo/instance root (e.g. ``energetica/static/app``
    or ``dist-lobby``). Returns ``None`` when the bundle has no stamp — an old bundle built
    before this stamping existed, or a dev server that serves the app from vite instead.
    """
    return _read_json(REPO_ROOT / bundle_subpath / "build-info.json")
