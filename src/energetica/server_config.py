"""Server-wide configuration, read by the lobby.

The server-wide analog of the per-instance ``instance.json``: a small admin-owned file, re-read
fresh on every call (no cache) so admin edits take effect without a restart. It currently carries
only the signup toggle — the server-wide replacement for the per-instance ``disable_signups`` the
lobby (no engine, no slug) cannot reuse (ADR-0003). ``setup-base.sh`` writes the initial file.

    {ENERGETICA_SERVER_CONFIG_PATH}   (default: /etc/energetica/server.json)
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from pydantic import BaseModel, StrictBool

logger = logging.getLogger(__name__)

_CONFIG_PATH_ENV_VAR = "ENERGETICA_SERVER_CONFIG_PATH"
_DEFAULT_CONFIG_PATH = "/etc/energetica/server.json"


class ServerConfig(BaseModel):
    # ``forbid`` so a config we don't recognise fails closed (below) rather than being read with a
    # partially-guessed shape.
    model_config = {"extra": "forbid"}

    # StrictBool: only a real JSON boolean enables signups. A stray string/number ("yes", 1) is
    # rejected → fail closed, rather than lax-coerced into silently opening signup. Defaults to
    # disabled — an omitted toggle is the safe direction (see signups_enabled).
    signups_enabled: StrictBool = False


def _config_path() -> Path:
    return Path(os.environ.get(_CONFIG_PATH_ENV_VAR, _DEFAULT_CONFIG_PATH))


def signups_enabled() -> bool:
    """Whether open signup is enabled server-wide, read fresh from ``server.json``.

    **Fails closed:** a missing or malformed file → signups *disabled*. ``server.json`` is written
    by ``setup-base.sh``, so its absence means misconfiguration, and a broken toggle must never
    accidentally throw open account creation to the world. Closed-enrollment deployments create
    accounts by direct bootstrap instead (ADR-0003), so signups-off is a benign degraded state.
    """
    path = _config_path()
    try:
        config = ServerConfig.model_validate_json(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        # ValueError covers pydantic ValidationError and JSON decode errors.
        logger.warning("signups disabled: could not read server config at %s: %s", path, exc)
        return False
    return config.signups_enabled
