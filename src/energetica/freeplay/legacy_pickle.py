"""Load engine state that was pickled before its classes moved.

Pickle records each object's class by its module path, and reimports that path to rebuild the
object. ``instance/engine_data.pck`` holds the whole model store, so every copy of it written before
#1055, including the ones inside checkpoints, names the entity models ``energetica.database.*``.
Those modules now live under ``energetica.freeplay.database``, and nothing is left at the old path.

:func:`load` reads such a file by translating each old module path to its new one as the pickle
names it. The next save writes the new paths, so a live instance only needs this once. Old
checkpoints keep needing it for as long as they are kept.
"""

from __future__ import annotations

import pickle
from typing import IO, Any

# Old module path -> new module path. A key also covers every module beneath it.
MOVED_MODULES = {
    "energetica.database": "energetica.freeplay.database",
}


def _current_path(module: str) -> str:
    for old, new in MOVED_MODULES.items():
        if module == old or module.startswith(old + "."):
            return new + module[len(old) :]
    return module


class _MovedModuleUnpickler(pickle.Unpickler):
    def find_class(self, module: str, name: str) -> Any:
        return super().find_class(_current_path(module), name)


def load(file: IO[bytes]) -> Any:
    """Unpickle ``file`` like :func:`pickle.load`, finding moved classes at their current path."""
    return _MovedModuleUnpickler(file).load()
