#!.venv/bin/python
"""Create, show, change and delete runs from the shell (#1313, ADR-0010).

Run from the lobby directory (this script is deployed only there). It is a client of the lobby
service's internal API (ADR-0009), so it never opens the database itself. A run's config takes
effect on the next read: no restart, no redeploy.

Usage (from /var/www/energetica-lobby):
    ./scripts/run.py list
    ./scripts/run.py <slug> show
    ./scripts/run.py <slug> create --mode freeplay|workshop --name <name> --starts-at <time>
                                   [--advertised true|false] [--policy public|private]
                                   [--freeze-at <time>] [--ended-at <time>]
    ./scripts/run.py <slug> set [--name <name>] [--advertised true|false] [--policy public|private]
                                [--starts-at <time>] [--freeze-at <time>|none] [--ended-at <time>|none]
    ./scripts/run.py <slug> delete [--with-members]

    [--socket <path>]

A <time> is ISO 8601 with a time zone, such as 2026-03-01T12:00:00Z or 2026-03-01T13:00:00+01:00.
The service stores it in UTC, to the second.

``create`` makes a run advertised unless told otherwise, and private if it is a Workshop and public
if not, as ``setup-instance.sh`` did. Making a private run public with ``set --policy public``
drops its join link. ``delete`` asks you to type the slug back, and refuses a run that anyone has
joined or holds a facilitator grant for, unless ``--with-members`` deletes those too.

If --socket is omitted it defaults to the production socket /run/energetica/lobby-service.sock.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

from energetica.identity.lobby_service_client import (
    LobbyServiceClient,
    LobbyServiceRefusal,
    LobbyServiceUnavailable,
)
from energetica.identity.schemas.lobby_service import LobbyServiceErrorCode, RunCreate, RunOut, RunUpdate


def _time(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        raise argparse.ArgumentTypeError(f"not an ISO 8601 time: {value!r}")
    if parsed.tzinfo is None:
        raise argparse.ArgumentTypeError(f"{value!r} has no time zone; add one, such as Z or +01:00")
    return parsed


def _time_or_none(value: str) -> datetime | None:
    return None if value == "none" else _time(value)


def _bool(value: str) -> bool:
    if value not in ("true", "false"):
        raise argparse.ArgumentTypeError(f"expected true or false, got {value!r}")
    return value == "true"


_SOCKET_HELP = "The lobby service's socket (default: the production path /run/energetica/lobby-service.sock)."


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--socket", type=Path, default=Path("/run/energetica/lobby-service.sock"), help=_SOCKET_HELP)
    parser.add_argument("target", help="'list', or the slug of the run to act on.")
    actions = parser.add_subparsers(dest="action")
    # Each action accepts --socket too, so it can come last as the usage shows. SUPPRESS keeps an
    # action that was not given --socket from overwriting the top-level default.
    socket = argparse.ArgumentParser(add_help=False)
    socket.add_argument("--socket", type=Path, default=argparse.SUPPRESS, help=_SOCKET_HELP)

    actions.add_parser("show", parents=[socket], help="Show the run's config and phase.")

    create = actions.add_parser("create", parents=[socket], help="Create the run.")
    create.add_argument("--mode", choices=["freeplay", "workshop"], required=True)
    create.add_argument("--name", required=True)
    create.add_argument("--starts-at", type=_time, required=True)
    create.add_argument("--advertised", type=_bool, default=True)
    create.add_argument("--policy", choices=["public", "private"])
    create.add_argument("--freeze-at", type=_time)
    create.add_argument("--ended-at", type=_time)

    # SUPPRESS leaves an option that was not given out of the namespace, so `set` can tell it
    # apart from `--freeze-at none`, which clears the field.
    edit = actions.add_parser("set", parents=[socket], help="Change some of the run's fields.")
    edit.add_argument("--name", default=argparse.SUPPRESS)
    edit.add_argument("--advertised", type=_bool, default=argparse.SUPPRESS)
    edit.add_argument("--policy", dest="access_policy", choices=["public", "private"], default=argparse.SUPPRESS)
    edit.add_argument("--starts-at", type=_time, default=argparse.SUPPRESS)
    edit.add_argument("--freeze-at", type=_time_or_none, default=argparse.SUPPRESS, help="A time, or 'none'.")
    edit.add_argument("--ended-at", type=_time_or_none, default=argparse.SUPPRESS, help="A time, or 'none'.")

    delete = actions.add_parser("delete", parents=[socket], help="Delete the run.")
    delete.add_argument("--with-members", action="store_true", help="Also delete its memberships and grants.")
    return parser


def main() -> int:
    parser = _parser()
    args = parser.parse_args()
    # `list` alone lists the runs. Followed by an action, it is a slug like any other.
    if args.action is None and args.target != "list":
        parser.error("name an action: show, create, set or delete")

    service = LobbyServiceClient.connect("run-py", socket_path=args.socket)
    try:
        return _run(service, args)
    except LobbyServiceRefusal as refusal:
        print(f"ERROR: the lobby service refused: {refusal.message or refusal.code}", file=sys.stderr)
        return 1
    except LobbyServiceUnavailable as exc:
        print(f"ERROR: cannot reach the lobby service at {args.socket}: {exc.reason}", file=sys.stderr)
        return 1


def _run(service: LobbyServiceClient, args: argparse.Namespace) -> int:
    if args.action is None:
        runs = service.list_runs()
        if not runs:
            print("No runs.")
        for run in runs:
            hidden = "" if run.advertised else ", not advertised"
            print(f"  {run.slug}: {run.name} ({run.mode}, {run.access_policy}{hidden}, {run.phase})")
        return 0

    slug = args.target
    if args.action == "show":
        run = service.get_run(slug)
        if run is None:
            print(f"ERROR: no run is called {slug!r}", file=sys.stderr)
            return 1
        _print_run(run)
    elif args.action == "create":
        policy = args.policy or ("private" if args.mode == "workshop" else "public")
        run = service.create_run(
            slug,
            RunCreate(
                name=args.name,
                mode=args.mode,
                advertised=args.advertised,
                access_policy=policy,
                starts_at=args.starts_at,
                freeze_at=args.freeze_at,
                ended_at=args.ended_at,
            ),
        )
        print(f"Created {slug!r}:")
        _print_run(run)
    elif args.action == "set":
        return _set(service, slug, args)
    else:
        return _delete(service, slug, with_members=args.with_members)
    return 0


def _set(service: LobbyServiceClient, slug: str, args: argparse.Namespace) -> int:
    fields = ("name", "advertised", "access_policy", "starts_at", "freeze_at", "ended_at")
    given = {field: getattr(args, field) for field in fields if hasattr(args, field)}
    if not given:
        print("ERROR: 'set' needs at least one field to change", file=sys.stderr)
        return 2
    if given.get("access_policy") == "public":
        # A public run has no join link, so the service refuses the change while one is set.
        given |= {"join_token": None, "join_open": False}
    before = service.get_run(slug)
    run = service.update_run(slug, RunUpdate(**given))
    if before is not None and before.join_token is not None and run.join_token is None:
        print("The run is public now, so its join link no longer works.")
    print(f"Updated {slug!r}:")
    _print_run(run)
    return 0


def _delete(service: LobbyServiceClient, slug: str, *, with_members: bool) -> int:
    run = service.get_run(slug)
    if run is None:
        print(f"ERROR: no run is called {slug!r}", file=sys.stderr)
        return 1
    _print_run(run)
    members = " and every membership and facilitator grant for it" if with_members else ""
    answer = input(f"This deletes the run{members}. Type the slug to confirm: ")
    if answer.strip() != slug:
        print("Not deleted.")
        return 1
    try:
        service.delete_run(slug, with_members=with_members)
    except LobbyServiceRefusal as refusal:
        if refusal.code != LobbyServiceErrorCode.RUN_HAS_MEMBERS:
            raise
        print(f"ERROR: {refusal.message}. Pass --with-members to delete them too.", file=sys.stderr)
        return 1
    print(f"Deleted {slug!r}.")
    return 0


def _print_run(run: RunOut) -> None:
    def time(value: datetime | None) -> str:
        return value.isoformat() if value is not None else "none"

    # The token itself is a secret that admits anyone holding it, so it is never printed. A
    # facilitator shares the link from the run's facilitator page.
    if run.join_token is None:
        join_link = "none yet"
    else:
        join_link = "open" if run.join_open else "closed"
    print(f"  slug:       {run.slug}")
    print(f"  name:       {run.name}")
    print(f"  mode:       {run.mode}")
    print(f"  phase:      {run.phase}")
    print(f"  advertised: {str(run.advertised).lower()}")
    print(f"  policy:     {run.access_policy}")
    if run.access_policy == "private":
        print(f"  join link:  {join_link}")
    print(f"  starts_at:  {time(run.starts_at)}")
    print(f"  freeze_at:  {time(run.freeze_at)}")
    print(f"  ended_at:   {time(run.ended_at)}")
    print(f"  created_at: {run.created_at}")


if __name__ == "__main__":
    sys.exit(main())
