"""Writing a Workshop file so that a crash mid-write leaves the previous file whole."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path


def write_atomically(path: Path, data: str | bytes) -> None:
    """Write ``data`` to ``path``, text as UTF-8, so that a crash mid-write leaves the previous file whole.

    Writes a temporary file beside ``path`` and renames it into place, which replaces the file in
    one step.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=path.parent, prefix=f"{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as tmp_file:
            tmp_file.write(data.encode("utf-8") if isinstance(data, str) else data)
        os.replace(tmp_name, path)
    except BaseException:
        Path(tmp_name).unlink(missing_ok=True)
        raise
