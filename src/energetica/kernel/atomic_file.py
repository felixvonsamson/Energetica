"""Writing a file so that a crash mid-write leaves the previous file whole."""

from __future__ import annotations

import os
import stat
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import BinaryIO


@contextmanager
def open_atomically(path: Path) -> Iterator[BinaryIO]:
    """Open a binary file to write in place of ``path``, so that a crash mid-write leaves the previous file whole.

    Writes go to a temporary file beside ``path``. When the block ends without raising, the
    temporary file is flushed to disk and renamed over ``path``, which replaces the file in one
    step. If the block raises, the temporary file is deleted and ``path`` is left untouched.

    The new file keeps the mode of the file it replaces, or gets ``0o644`` if there was none.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        mode = stat.S_IMODE(path.stat().st_mode)
    except FileNotFoundError:
        mode = 0o644
    fd, tmp_name = tempfile.mkstemp(dir=path.parent, prefix=f"{path.name}.", suffix=".tmp")
    try:
        # mkstemp makes the file owner-only, but scripts/download-instance.sh backs up instance/
        # as another user, so it must stay readable to them.
        os.fchmod(fd, mode)
        with os.fdopen(fd, "wb") as tmp_file:
            yield tmp_file
            tmp_file.flush()
            # Without this, a power loss soon after the rename can leave `path` empty or partial.
            os.fsync(tmp_file.fileno())
        os.replace(tmp_name, path)
    except BaseException:
        Path(tmp_name).unlink(missing_ok=True)
        raise


def write_atomically(path: Path, data: str | bytes) -> None:
    """Write ``data`` to ``path``, text as UTF-8, so that a crash mid-write leaves the previous file whole."""
    with open_atomically(path) as file:
        file.write(data.encode("utf-8") if isinstance(data, str) else data)
