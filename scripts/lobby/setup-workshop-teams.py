#!.venv/bin/python
"""Set up a Workshop Run's teams: their accounts, the roster, the teams block and the credentials file (#1385).

Run from the lobby directory (this script is deployed only there), as the user the Run's process runs as, so that it
can rewrite the Run's instance.json and the credentials file is readable by the Run alone:

    sudo -u energetica ./scripts/setup-workshop-teams.py <slug> --csv players.csv [--expires-in 7d]
    sudo -u energetica ./scripts/setup-workshop-teams.py <slug> --teams 8 --size 3 [--expires-in 7d]

    [--socket <path>] [--config-dir <dir>] [--instance-dir <dir>]

With --csv, the file has the columns account_name,team_name, such as "Romanel,Romande Energie". Teams are ordered by
where each first appears, which is also the scoreboard's tie-break. With --teams and --size, the accounts are named
team1-a to team8-c, in teams Team 1 to Team 8.

The script checks everything first. If anything is wrong, it lists every problem and stops with nothing changed.
Otherwise it creates each account as a temporary account that expires after --expires-in (7 days by default, such as
36h or 90m), adds it to the Run's roster, writes the credentials file to <instance-dir>/instance/
workshop_credentials.json and writes the teams into <config-dir>/<slug>/instance.json. Restart the Run afterwards
(systemctl restart energetica-<slug>) so it reads its teams. The facilitator prints the slips from the Run's
facilitator settings page.

The defaults are the production paths: the socket /run/energetica/lobby-service.sock, the config directory
/etc/energetica and the instance directory /var/www/energetica-<slug>.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

from energetica.identity.lobby_service_client import LobbyServiceClient, LobbyServiceUnavailable
from energetica.workshop.credentials import CREDENTIALS_PATH
from energetica.workshop.team_setup import (
    TeamSetup,
    generated_roster,
    parse_duration,
    read_roster_csv,
    set_up_teams,
    setup_problems,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("slug", help="The Workshop Run's slug.")
    parser.add_argument("--csv", type=Path, help="A CSV file with the columns account_name,team_name.")
    parser.add_argument("--teams", type=int, help="How many teams to generate.")
    parser.add_argument("--size", type=int, help="How many accounts each generated team has (at most 26).")
    parser.add_argument("--expires-in", default="7d", help="How long the accounts last, such as 7d, 36h or 90m.")
    parser.add_argument("--socket", type=Path, default=Path("/run/energetica/lobby-service.sock"))
    parser.add_argument("--config-dir", type=Path, default=Path("/etc/energetica"))
    parser.add_argument("--instance-dir", type=Path, help="The Run's directory (default: /var/www/energetica-<slug>).")
    return parser


def main() -> int:
    parser = _parser()
    args = parser.parse_args()

    if args.csv is not None:
        if args.teams is not None or args.size is not None:
            parser.error("give either --csv, or --teams and --size, not both")
        try:
            teams, problems = read_roster_csv(args.csv.read_text(encoding="utf-8-sig"))
        except OSError as exc:
            parser.error(f"cannot read {args.csv}: {exc}")
    elif args.teams is not None and args.size is not None:
        if not 1 <= args.size <= 26:
            parser.error("--size must be between 1 and 26")
        teams, problems = generated_roster(teams=args.teams, size=args.size), []
    else:
        parser.error("give either --csv, or --teams and --size")
    try:
        lifetime = parse_duration(args.expires_in)
    except ValueError as exc:
        parser.error(f"--expires-in: {exc}")

    instance_dir = args.instance_dir if args.instance_dir is not None else Path(f"/var/www/energetica-{args.slug}")
    setup = TeamSetup(
        slug=args.slug,
        config_path=args.config_dir / args.slug / "instance.json",
        credentials_path=instance_dir / CREDENTIALS_PATH,
    )
    service = LobbyServiceClient.connect("setup-workshop-teams", socket_path=args.socket)
    try:
        problems += setup_problems(service, setup, teams)
        if problems:
            print("Nothing was changed. Fix these problems and run the script again:", file=sys.stderr)
            for problem in problems:
                print(f"  - {problem}", file=sys.stderr)
            return 1
        # The lobby service keeps times to the second.
        expires_at = (datetime.now(timezone.utc) + lifetime).replace(microsecond=0)
        credentials = set_up_teams(service, setup, teams, expires_at=expires_at)
    except LobbyServiceUnavailable as exc:
        print(f"ERROR: cannot reach the lobby service at {args.socket}: {exc.reason}", file=sys.stderr)
        return 1

    size = len(teams[0].members)
    print(f"Set up {len(teams)} teams of {size} on {args.slug}, with accounts that expire at {expires_at.isoformat()}.")
    print(f"Wrote {len(credentials.accounts)} accounts' passwords to {setup.credentials_path}")
    print(f"Wrote the teams to {setup.config_path}")
    print(f"Restart the Run so it reads its teams: sudo systemctl restart energetica-{args.slug}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
