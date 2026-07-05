#!/usr/bin/env -S python3 -u
"""Entry point for the lobby service (``docs/architecture/lobby.md``).

Runs the instance-independent lobby app (signup / login / session / my-runs) on its own port,
separate from any game instance. In production the systemd unit ``energetica-lobby.service`` sets
``ENERGETICA_APEX_DOMAIN``, the shared-secret path, the accounts-DB path and the landing dir, and
Apache (``apache-lobby.conf``) proxies ``/api/v1`` and ``/logout`` to this process.

    python main_lobby.py --port 8001
"""

import argparse

import uvicorn

from lobby import create_lobby_app

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the Energetica lobby service.")
    parser.add_argument("--host", default="127.0.0.1", help="Interface to bind (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8001, help="Port to listen on (default: 8001)")
    args = parser.parse_args()

    uvicorn.run(create_lobby_app(), host=args.host, port=args.port)
