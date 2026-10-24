"""The ``lobby.db`` schema migration steps.

Each step is a module named ``NNNN_<slug>.py``, numbered from 0001 with no gaps, holding one
``migrate(conn)`` function. Step N takes a database from state version N - 1 to N.
:func:`lobby_service.schema.upgrade_database` runs the pending ones in order, inside a transaction
it opens and commits, so a step must not commit itself.

A new step must also change :func:`lobby_service.schema.create_current_schema`, so that a new
database matches one that ran every step. ``tests/unit/test_lobby_db_migrations.py`` checks this.
"""
