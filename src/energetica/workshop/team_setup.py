"""Setting up a Workshop Run's teams from the shell (#1385), for ``scripts/lobby/setup-workshop-teams.py``.

The teams come from a CSV of ``account_name,team_name`` lines, or are generated. :func:`setup_problems` checks
everything first and lists every problem it finds. Only if there are none does :func:`set_up_teams` change anything:
it creates each account as a temporary account with a generated password, adds it to the Run's roster, writes the
credentials file (:mod:`energetica.workshop.credentials`) and writes the ``teams`` block into the Run's
``instance.json``. Accounts are reached through the lobby service (ADR-0009).
"""

from __future__ import annotations

import csv
import io
import os
import re
import secrets
import string
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from energetica.identity.instance_config import (
    InstanceConfig,
    InstanceConfigError,
    Team,
    WorkshopRun,
    read_instance_config,
    write_instance_config,
)
from energetica.identity.lobby_service_client import LobbyServiceClient
from energetica.workshop.credentials import CredentialLine, WorkshopCredentials, write_credentials

CSV_COLUMNS = ("account_name", "team_name")
MAX_ACCOUNT_NAME_LENGTH = 32
MAX_TEAM_NAME_LENGTH = 64
# Lowercase letters and digits, without those that are easily misread on a printed slip: 0 and o, 1, i and l.
_PASSWORD_ALPHABET = "".join(c for c in string.ascii_lowercase + string.digits if c not in "0o1il")
_PASSWORD_LENGTH = 10
_DURATION_UNITS = {"d": "days", "h": "hours", "m": "minutes"}


@dataclass(frozen=True)
class TeamSetup:
    """The Run to set up, and where its files are."""

    slug: str
    config_path: Path
    credentials_path: Path


def read_roster_csv(text: str) -> tuple[list[Team], list[str]]:
    """The teams a CSV of ``account_name,team_name`` lines describes, and every problem with the file.

    Teams are in the order each first appears. Blank lines and spaces around cells are ignored, and the two columns
    may come in either order.
    """
    rows = [(number, row) for number, row in enumerate(csv.reader(io.StringIO(text)), start=1) if "".join(row).strip()]
    if not rows:
        return [], ["the CSV is empty"]
    (_, header), lines = rows[0], rows[1:]
    header = [cell.strip() for cell in header]
    if sorted(header) != sorted(CSV_COLUMNS):
        return [], [f"the CSV's header must name the columns {' and '.join(CSV_COLUMNS)}, not {', '.join(header)}"]
    account_column, team_column = header.index("account_name"), header.index("team_name")

    members: dict[str, list[str]] = {}
    problems = []
    for number, row in lines:
        if len(row) != len(CSV_COLUMNS):
            problems.append(f"line {number}: expected {len(CSV_COLUMNS)} cells, found {len(row)}")
            continue
        account, team = row[account_column].strip(), row[team_column].strip()
        if not account:
            problems.append(f"line {number}: the account name is empty")
        elif not team:
            problems.append(f"line {number}: the team name is empty")
        else:
            members.setdefault(team, []).append(account)
    return [Team(name=name, members=accounts) for name, accounts in members.items()], problems


def generated_roster(*, teams: int, size: int) -> list[Team]:
    """``teams`` teams named ``Team 1`` and on, each of ``size`` accounts named ``team1-a`` and on."""
    return [
        Team(name=f"Team {number}", members=[f"team{number}-{letter}" for letter in string.ascii_lowercase[:size]])
        for number in range(1, teams + 1)
    ]


def parse_duration(text: str) -> timedelta:
    """A positive whole number of days, hours or minutes, such as ``7d``, ``36h`` or ``90m``."""
    match = re.fullmatch(r"([1-9]\d*)([dhm])", text)
    if match is None:
        raise ValueError(f"expected a duration such as 7d, 36h or 90m, got {text!r}")
    return timedelta(**{_DURATION_UNITS[match[2]]: int(match[1])})


def generate_password() -> str:
    """A random password that reads clearly off a printed slip."""
    return "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(_PASSWORD_LENGTH))


def _valid_account_name(name: str) -> bool:
    return 1 <= len(name) <= MAX_ACCOUNT_NAME_LENGTH and name.isprintable() and not any(c.isspace() for c in name)


def _valid_team_name(name: str) -> bool:
    return 1 <= len(name) <= MAX_TEAM_NAME_LENGTH and name.isprintable() and bool(name.strip())


def _roster_problems(teams: list[Team]) -> list[str]:
    problems = []
    if len(teams) < 2:
        problems.append(f"a Run with teams needs at least 2 teams, not {len(teams)}")
    if len({len(team.members) for team in teams}) > 1:
        sizes = ", ".join(f"{team.name!r} has {len(team.members)}" for team in teams)
        problems.append(f"every team must have the same number of accounts, but {sizes}")
    names = Counter(team.name for team in teams)
    problems += [f"the team name {name!r} appears more than once" for name, count in names.items() if count > 1]
    problems += [
        f"the team name {name!r} must be 1 to {MAX_TEAM_NAME_LENGTH} printable characters"
        for name in names
        if not _valid_team_name(name)
    ]
    accounts = Counter(member for team in teams for member in team.members)
    problems += [
        f"the account name {account!r} must be 1 to {MAX_ACCOUNT_NAME_LENGTH} printable characters, without spaces"
        for account in accounts
        if not _valid_account_name(account)
    ]
    problems += [f"the account name {account!r} appears more than once" for account, n in accounts.items() if n > 1]
    return problems


def _existing_account_problems(service: LobbyServiceClient, teams: list[Team]) -> list[str]:
    """An account name that is already taken, such as by an earlier workshop's accounts that have not expired yet."""
    problems = []
    for name in dict.fromkeys(member for team in teams for member in team.members):
        if not _valid_account_name(name):
            continue
        account = service.get_account_by_username(name)
        if account is None:
            continue
        expiry = "" if account.expires_at is None else f" (a temporary account, expiring {account.expires_at})"
        problems.append(f"an account named {name!r} already exists{expiry}")
    return problems


def _run_problems(service: LobbyServiceClient, setup: TeamSetup) -> list[str]:
    problems = []
    run = service.get_run(setup.slug)
    if run is not None and run.mode != "workshop":
        problems.append(f"the lobby service has {setup.slug} as a {run.mode} Run, not a workshop Run")
    if not setup.config_path.exists():
        problems.append(f"there is no instance.json at {setup.config_path}")
    else:
        try:
            config = read_instance_config(setup.config_path)
        except InstanceConfigError as exc:
            problems.append(str(exc))
        else:
            if not isinstance(config.run, WorkshopRun):
                problems.append(f"{setup.slug} is a {config.run.mode} Run, not a workshop Run")
            elif config.run.teams is not None:
                problems.append(
                    f"{setup.slug} already has teams; remove its teams block from {setup.config_path} by hand to "
                    f"replace them"
                )
        # The config directory is sticky, so only the file's owner can replace it (see instance_config).
        owner = setup.config_path.stat().st_uid
        if owner != os.geteuid():
            problems.append(
                f"only the owner of {setup.config_path} can rewrite it; run this as that user (uid {owner})"
            )
    instance_dir = setup.credentials_path.parent
    if not instance_dir.is_dir():
        problems.append(f"there is no instance directory at {instance_dir}")
    elif not os.access(instance_dir, os.W_OK):
        problems.append(f"cannot write to the instance directory {instance_dir}")
    return problems


def setup_problems(service: LobbyServiceClient, setup: TeamSetup, teams: list[Team]) -> list[str]:
    """Everything that would stop :func:`set_up_teams` from setting up ``teams``, or nothing if it can."""
    return _roster_problems(teams) + _existing_account_problems(service, teams) + _run_problems(service, setup)


def set_up_teams(
    service: LobbyServiceClient, setup: TeamSetup, teams: list[Team], *, expires_at: datetime
) -> WorkshopCredentials:
    """Create the accounts of ``teams``, add them to the Run's roster, and write the credentials and the teams.

    Call :func:`setup_problems` first: this assumes there are none. The credentials are written before the teams, so
    that if writing the teams fails, the passwords of the accounts just created are not lost.
    """
    lines = []
    for team in teams:
        for username in team.members:
            password = generate_password()
            account = service.create_account(username=username, password=password, expires_at=expires_at)
            service.add_run_member(setup.slug, account.account_id)
            lines.append(CredentialLine(team=team.name, username=username, password=password))
    credentials = WorkshopCredentials(expires_at=expires_at, accounts=lines)
    write_credentials(setup.credentials_path, credentials)

    config = read_instance_config(setup.config_path)
    assert isinstance(config.run, WorkshopRun)  # setup_problems checked it
    run = WorkshopRun(mode="workshop", teams=teams)
    write_instance_config(setup.config_path, InstanceConfig.model_validate({**config.model_dump(), "run": run}))
    return credentials
