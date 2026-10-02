"""Workshop Mode: a second, purpose-built Run format for moderated live sessions.

See issue #992 for the full spec. Workshop is an application package (#1049): it imports only from
``energetica.kernel``, ``energetica.identity`` and ``energetica.sim``. It never imports the
persistent world in ``energetica.freeplay``, or the modules still waiting to move there. Anything
Workshop shares with the persistent world lives in one of those three layers; everything else is
built fresh here. ``tests/unit/test_module_boundary.py`` enforces this.

A Workshop Run's backend serves the app in :mod:`energetica.workshop.app`, chosen at startup by
``energetica.entry``. The Run's whole state is one :class:`~energetica.workshop.session.WorkshopSession`,
saved to a JSON file after every change (#994). The persistent world's model store and checkpoints
belong to ``freeplay`` and are deliberately not reused (#1049).
"""
