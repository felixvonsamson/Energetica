"""The lobby service: the one process that opens ``lobby.db`` (ADR-0009).

It owns accounts, server-wide sessions and memberships, and serves them over a versioned internal
HTTP API (``/internal/v1``) on a Unix socket that only processes on the same server can reach. The
lobby backend, every run and the operator scripts are its clients, through
:mod:`energetica.identity.lobby_service_client`.

Schema migrations run once, at start-up, before the service accepts connections
(:mod:`lobby_service.schema`). The entry point is ``main_lobby_service.py``.
"""
