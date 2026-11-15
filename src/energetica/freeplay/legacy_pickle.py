"""Load instance files that were pickled before the classes they name moved.

Pickle records each object's class by its module path, and reimports that path to rebuild the
object. ``instance/engine_data.pck`` holds the whole model store, so every copy of it written before
#1055, including the ones inside checkpoints, names the entity models ``energetica.database.*``.
Those modules now live under ``energetica.freeplay.database``, and nothing is left at the old path.

Likewise, every copy written before #1056 names the enumerations the models hold
``energetica.enums``, which now lives at ``energetica.freeplay.enums``. The chart files under
``instance/data/`` (player and network history, market snapshots) can hold enums too, as keys, so
anything that reads an instance pickle reads it through :func:`load`.

:func:`load` reads such a file by translating each old module path to its new one as the pickle
names it. The next save writes the new paths, so a file that is rewritten only needs this once.
Old checkpoints, and chart files that are never rewritten, such as market snapshots, keep needing
it for as long as they are kept.
"""

from __future__ import annotations

import pickle
from typing import IO, Any

# Old module path -> new module path. A key also covers every module beneath it.
MOVED_MODULES = {
    "energetica.database": "energetica.freeplay.database",
    "energetica.enums": "energetica.freeplay.enums",
}


def _current_module(module: str) -> str:
    for old, new in MOVED_MODULES.items():
        if module == old or module.startswith(old + "."):
            return new + module[len(old) :]
    return module


class _MovedModuleUnpickler(pickle.Unpickler):
    def find_class(self, module: str, name: str) -> Any:
        return super().find_class(_current_module(module), name)


def load(file: IO[bytes]) -> Any:
    """Unpickle ``file`` like :func:`pickle.load`, finding moved classes at their current path."""
    return _MovedModuleUnpickler(file).load()
