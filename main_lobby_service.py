#!/usr/bin/env -S python3 -u
"""
Entry point for the lobby service (ADR-0009), the one process that opens ``lobby.db``.

Brings the database up to date first, then serves the internal API. Connections that arrive while
migrations run wait in the socket's queue, so the service never answers on an old schema.

In production, systemd holds the socket (``energetica-lobby-service.socket``) and passes it in as
file descriptor 3; in local development the service binds a Unix socket itself:

    python main_lobby_service.py --fd 3
    python main_lobby_service.py --uds .energetica-dev/lobby-service.sock
"""

import argparse
import logging
import sys
from pathlib import Path

import uvicorn

# Import from the `src/` next to this file. A git worktree shares the main checkout's .venv, whose
# editable install points at the main checkout's `src/`.
sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from lobby_service.app import create_service_app
from lobby_service.config import db_path
from lobby_service.schema import SCHEMA_VERSION, upgrade_database

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the Energetica lobby service.")
    listen = parser.add_mutually_exclusive_group(required=True)
    listen.add_argument("--fd", type=int, help="Serve on this already-open socket (systemd socket activation)")
    listen.add_argument("--uds", type=Path, help="Bind and serve on this Unix socket path (local development)")
    args = parser.parse_args()

    # The service logs one line per request, naming its caller.
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    path = db_path()
    upgrade_database(path)
    logging.getLogger("lobby_service").info("%s is at state version %s", path, SCHEMA_VERSION)

    if args.fd is not None:
        uvicorn.run(create_service_app(), fd=args.fd)
    else:
        # A socket file left behind by a previous run that did not shut down cleanly stops bind.
        args.uds.unlink(missing_ok=True)
        uvicorn.run(create_service_app(), uds=str(args.uds))
