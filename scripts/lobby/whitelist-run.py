#!.venv/bin/python
"""Grow (or trim) a private run's roster from the shell (#1030 follow-up, ADR-0007).

Run from the lobby directory (this script is deployed only there). It is a client of the lobby
service's internal API (ADR-0009), so it never opens the database itself.

Replaces ``scripts/infra/whitelist-instance.sh``, which edited ``instance.json``'s
``allowed_usernames`` directly — the backend no longer reads that field. This makes the same
membership changes the in-app facilitator roster page (#1022) makes, just reachable from the shell
for a sysadmin who would rather not (or cannot yet) go through the facilitator UI. Unlike the
retired shell script, this does not touch or require a private ``access.policy`` — the roster lives
in the lobby service regardless of what a run's ``instance.json`` currently says, though it is only
*consulted* by the entry gate for a privately-configured run.

Usage (from /var/www/energetica-lobby):
    ./scripts/whitelist-run.py <slug> list
    ./scripts/whitelist-run.py <slug> add    <username> [<username> ...]
    ./scripts/whitelist-run.py <slug> remove <username> [<username> ...]

    [--socket <path>]

If --socket is omitted it defaults to the production socket /run/energetica/lobby-service.sock
(this is a production-only tool, so it pins the production path rather than inheriting the
client's dev default). Edits take effect on the next entry attempt — no restart, no redeploy (the
entry gate checks membership fresh on every request, same as it always re-read instance.json).
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
    parser.add_argument("slug", help="The run's instance slug.")
    parser.add_argument("action", choices=["list", "add", "remove"])
    parser.add_argument("usernames", nargs="*", help="Usernames to add/remove (ignored for 'list').")
    parser.add_argument(
        "--socket",
        type=Path,
        default=Path("/run/energetica/lobby-service.sock"),
        help="The lobby service's socket (default: the production path /run/energetica/lobby-service.sock).",
    )
    args = parser.parse_args()

    if args.action in ("add", "remove") and not args.usernames:
        print(f"ERROR: '{args.action}' requires at least one username", file=sys.stderr)
        return 2

    service = LobbyServiceClient.connect("whitelist-run", socket_path=args.socket)
    try:
        return _run(service, args.slug, args.action, args.usernames)
    except LobbyServiceUnavailable as exc:
        print(f"ERROR: cannot reach the lobby service at {args.socket}: {exc.reason}", file=sys.stderr)
        return 1


def _run(service: LobbyServiceClient, slug: str, action: str, usernames: list[str]) -> int:
    if action == "list":
        members = service.get_run_members(slug)
        if not members:
            print(f"No one on {slug!r}'s roster.")
            return 0
        for member in members:
            print(f"  {member.username} (joined {member.joined_at})")
        return 0

    for username in usernames:
        account = service.get_account_by_username(username)
        if action == "add":
            if account is None:
                print(f"ERROR: no account found for username {username!r} — skipped", file=sys.stderr)
                continue
            try:
                service.add_run_member(slug, account.account_id)
            except LobbyServiceRefusal as refusal:
                print(f"ERROR: the lobby service refused {username!r}: {refusal.code} — skipped", file=sys.stderr)
                continue
            print(f"Added {username!r} to {slug!r}'s roster.")
        else:
            if account is None:
                print(f"{username!r} has no account — nothing to remove.")
                continue
            service.remove_run_member(slug, account.account_id)
            print(f"Removed {username!r} from {slug!r}'s roster.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
