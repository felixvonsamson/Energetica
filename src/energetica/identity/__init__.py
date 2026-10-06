"""The identity layer: server-wide accounts and configuration, shared by the lobby and every instance.

The accounts store (:mod:`~energetica.identity.accounts`), instance configuration and the landing
dir it publishes to (:mod:`~energetica.identity.instance_config`), server configuration
(:mod:`~energetica.identity.server_config`), my-runs resolution
(:mod:`~energetica.identity.my_runs`), and the request dependencies that resolve the caller's
account and role (:mod:`~energetica.identity.web`) live here (see #1053, #1134). So do the wire
shapes those modules return or read: the my-runs response (:mod:`~energetica.identity.schemas.lobby`),
the recap published to the landing dir (:mod:`~energetica.identity.schemas.recap`), and the lobby's
login and sign-up bodies (:mod:`~energetica.identity.schemas.auth`).

The layer sits directly above :mod:`energetica.kernel` and imports from nothing else in the
namespace. That is what lets the lobby depend on it without pulling in the persistent world's
domain, routers, or real-time layer (ADR-0002); ``tests/unit/test_module_boundary.py`` checks it.
"""
