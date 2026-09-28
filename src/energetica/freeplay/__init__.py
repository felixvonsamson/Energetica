"""The persistent world: the game engine, its in-memory model store, and its entity models.

The engine (:mod:`~energetica.freeplay.game_engine`), the model base class and the id-keyed store
(:mod:`~energetica.freeplay.database`), the entity models beneath it, and the action log the engine
writes and replays (:mod:`~energetica.freeplay.action_log`, :mod:`~energetica.freeplay.schemas.simulate`)
live here (see #1055). They look generic, but each is justified by the persistent world's needs:
a large player count, a per-tick scan of the whole game graph, and years of pickled state. Workshop Mode shares none of that, so it must not import this package.

Importing this package constructs the engine and binds it to :data:`energetica.freeplay.globals.engine`.
That happens before any submodule loads, and it is load-bearing: the model base class registers every
subclass into the engine at class-definition time, and many modules copy ``globals.engine`` into their
own namespace when they are imported. The engine object is light (config and two small pickles, no
game domain, no I/O beyond a mkdir). The heavy game graph is imported lazily by
:func:`~energetica.freeplay.app.create_app`.
"""

from energetica.freeplay import globals
from energetica.freeplay.game_engine import GameEngine

engine = GameEngine()
globals.engine = engine
