"""Writing a file so that a crash mid-write leaves the previous file whole."""

from __future__ import annotations

import os
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
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=path.parent, prefix=f"{path.name}.", suffix=".tmp")
    try:
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
