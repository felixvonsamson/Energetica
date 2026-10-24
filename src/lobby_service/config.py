"""Lobby service configuration, read from the environment."""

from __future__ import annotations

import os
from pathlib import Path

# The default suits local development. Production sets the path in the systemd unit
# (scripts/infra/energetica-lobby-service.service).
_DEFAULT_DB_PATH = "instance/lobby.db"
_DB_PATH_ENV_VAR = "ENERGETICA_LOBBY_DB_PATH"


def db_path() -> Path:
    """Where ``lobby.db`` is."""
    return Path(os.environ.get(_DB_PATH_ENV_VAR, _DEFAULT_DB_PATH))
