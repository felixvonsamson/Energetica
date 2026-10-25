#!.venv/bin/python
"""Grant an existing account facilitator authority (ADR-0004).

There is no in-app path to becoming a facilitator: this is the *only* way, run by a sysadmin
over SSH, from the lobby directory (this script is deployed only there). It is a client of the
lobby service's internal API (ADR-0009), so it never opens the database itself. Grant-only by
design — no revoke command yet (YAGNI: a deployment has roughly one long-lived facilitator per
short-lived instance; add revoke the day it's actually needed).

Usage (from /var/www/energetica-lobby):
    ./scripts/grant-facilitator.py --username <username> [--slug <slug>] [--socket <path>]

If --slug is omitted, the grant is server-wide (facilitator over every instance) — see
docs/architecture/roles.md § How elevated access is granted. If --socket is omitted it defaults to
the production socket /run/energetica/lobby-service.sock (this is a production-only tool, so it
pins the production path rather than inheriting the client's dev default).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from energetica.identity.lobby_service_client import (
    LobbyServiceClient,
    LobbyServiceRefusal,
    LobbyServiceUnavailable,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--username", required=True, help="Username of the account to grant facilitator authority to.")
    parser.add_argument(
        "--slug",
        default=None,
        help="Instance slug to scope the grant to. Omit for a server-wide grant (every instance).",
    )
    parser.add_argument(
        "--socket",
        type=Path,
        default=Path("/run/energetica/lobby-service.sock"),
        help="The lobby service's socket (default: the production path /run/energetica/lobby-service.sock).",
    )
    args = parser.parse_args()

    service = LobbyServiceClient.connect("grant-facilitator", socket_path=args.socket)
    try:
        account = service.get_account_by_username(args.username)
        if account is None:
            print(f"ERROR: no account found for username {args.username!r}", file=sys.stderr)
            return 1
        service.grant_facilitator(account.account_id, slug=args.slug)
    except LobbyServiceRefusal as refusal:
        print(f"ERROR: the lobby service refused the grant: {refusal.code}", file=sys.stderr)
        return 1
    except LobbyServiceUnavailable as exc:
        print(f"ERROR: cannot reach the lobby service at {args.socket}: {exc.reason}", file=sys.stderr)
        return 1

    scope = "server-wide (every instance)" if args.slug is None else f"instance {args.slug!r}"
    print(f"Granted {args.username!r} facilitator authority, {scope}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
