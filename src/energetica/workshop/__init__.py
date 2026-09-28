"""Workshop Mode: a second, purpose-built Run format for moderated live sessions.

See issue #992 for the full spec. Workshop is an application package (#1049): it imports only from
``energetica.kernel``, ``energetica.identity`` and ``energetica.sim``. It never imports the
persistent world in ``energetica.freeplay``, or the modules still waiting to move there. Anything
Workshop shares with the persistent world lives in one of those three layers; everything else is
built fresh here. ``tests/unit/test_module_boundary.py`` enforces this.

**Persistence is deferred.** Workshop state lives in ordinary Python objects in the backend
process and is lost when the process restarts. The persistent world's model store and checkpoints
belong to ``freeplay`` and are deliberately not reused (#1049). How Workshop persists is decided
once its state machine is designed (#994), because the storage shape should follow the state shape.
"""
