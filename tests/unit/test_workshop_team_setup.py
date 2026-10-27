"""Setting up a Workshop Run's teams from the shell (#1385): checking everything first, then the accounts, the roster,
the ``teams`` block and the credentials file.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pytest

from energetica.identity.account import Account
from energetica.identity.instance_config import Team, WorkshopRun, read_instance_config
from energetica.identity.lobby_service_client import LobbyServiceClient, LobbyServiceUnavailable
from energetica.identity.schemas.lobby_service import CreatedAccount, RunCreate
from energetica.workshop.credentials import read_credentials
from energetica.workshop.session import WorkshopSession
from energetica.workshop.team_setup import (
    TeamSetup,
    generate_password,
    generated_roster,
    parse_duration,
    read_roster_csv,
    set_up_teams,
    setup_problems,
)

SLUG = "zurich-workshop"
NOW = datetime(2026, 3, 1, 12, 0, tzinfo=timezone.utc)
TEAMS = [
    Team(name="Axpo", members=["Laufenbourg", "Regensdorf"]),
    Team(name="Romande Energie", members=["Romanel", "Veytaux"]),
]


def _instance_json(run: dict[str, Any]) -> dict[str, Any]:
    return {"name": "Zurich workshop", "advertised": False, "starts_at": "2026-03-01T00:00:00Z", "run": run}


@pytest.fixture
def setup(tmp_path: Path) -> TeamSetup:
    config_path = tmp_path / "etc" / SLUG / "instance.json"
    config_path.parent.mkdir(parents=True)
    config_path.write_text(json.dumps(_instance_json({"mode": "workshop"})))
    (tmp_path / "app" / "instance").mkdir(parents=True)
    return TeamSetup(
        slug=SLUG,
        config_path=config_path,
        credentials_path=tmp_path / "app" / "instance" / "workshop_credentials.json",
    )


# --- reading the roster ---------------------------------------------------------------------


def test_a_csv_groups_accounts_into_teams_in_the_order_each_team_first_appears() -> None:
    teams, problems = read_roster_csv(
        "account_name,team_name\nRomanel,Romande Energie\nLaufenbourg,Axpo\nVeytaux,Romande Energie\nRegensdorf,Axpo\n"
    )

    assert problems == []
    assert teams == [
        Team(name="Romande Energie", members=["Romanel", "Veytaux"]),
        Team(name="Axpo", members=["Laufenbourg", "Regensdorf"]),
    ]


def test_a_csv_ignores_blank_lines_and_spaces_around_cells_and_takes_its_columns_in_any_order() -> None:
    teams, problems = read_roster_csv("team_name, account_name\n\nAxpo , Laufenbourg\n  \nAxpo,Regensdorf\n")

    assert problems == []
    assert teams == [Team(name="Axpo", members=["Laufenbourg", "Regensdorf"])]


def test_a_csv_without_the_two_columns_is_a_problem() -> None:
    _, problems = read_roster_csv("username,team\nRomanel,Romande Energie\n")

    assert problems == ["the CSV's header must name the columns account_name and team_name, not username, team"]


def test_a_csv_line_with_an_empty_cell_or_extra_cells_is_a_problem() -> None:
    _, problems = read_roster_csv("account_name,team_name\nRomanel,\n,Axpo\nBex,Axpo,extra\n")

    assert problems == [
        "line 2: the team name is empty",
        "line 3: the account name is empty",
        "line 4: expected 2 cells, found 3",
    ]


def test_generated_teams_are_numbered_with_lettered_accounts() -> None:
    assert generated_roster(teams=2, size=3) == [
        Team(name="Team 1", members=["team1-a", "team1-b", "team1-c"]),
        Team(name="Team 2", members=["team2-a", "team2-b", "team2-c"]),
    ]


@pytest.mark.parametrize(
    ("text", "expected"),
    [("7d", timedelta(days=7)), ("36h", timedelta(hours=36)), ("90m", timedelta(minutes=90))],
)
def test_a_duration_is_a_count_of_days_hours_or_minutes(text: str, expected: timedelta) -> None:
    assert parse_duration(text) == expected


@pytest.mark.parametrize("text", ["", "7", "0d", "-1d", "1w", "d", "1.5d"])
def test_other_durations_are_refused(text: str) -> None:
    with pytest.raises(ValueError):
        parse_duration(text)


def test_a_generated_password_is_long_enough_and_unambiguous() -> None:
    password = generate_password()

    assert len(password) >= 10
    assert not set(password) & set("0O1lI")


# --- checking before changing anything --------------------------------------------------------


def test_a_valid_setup_has_no_problems(lobby_service: LobbyServiceClient, setup: TeamSetup) -> None:
    assert setup_problems(lobby_service, setup, TEAMS) == []


def test_every_problem_with_the_teams_is_listed(lobby_service: LobbyServiceClient, setup: TeamSetup) -> None:
    teams = [
        Team(name="Axpo", members=["Laufenbourg", "Regensdorf", "Beznau"]),
        Team(name="Axpo", members=["Romanel", "Laufenbourg"]),
        Team(name="Alpiq\x07", members=["has space", "x" * 33]),
    ]

    assert setup_problems(lobby_service, setup, teams) == [
        "every team must have the same number of accounts, but 'Axpo' has 3, 'Axpo' has 2, 'Alpiq\\x07' has 2",
        "the team name 'Axpo' appears more than once",
        "the team name 'Alpiq\\x07' must be 1 to 64 printable characters",
        "the account name 'has space' must be 1 to 32 printable characters, without spaces",
        "the account name 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' must be 1 to 32 printable characters, without spaces",
        "the account name 'Laufenbourg' appears more than once",
    ]


def test_a_single_team_is_a_problem(lobby_service: LobbyServiceClient, setup: TeamSetup) -> None:
    assert setup_problems(lobby_service, setup, TEAMS[:1]) == ["a Run with teams needs at least 2 teams, not 1"]


def test_an_account_name_that_already_exists_is_a_problem(lobby_service: LobbyServiceClient, setup: TeamSetup) -> None:
    lobby_service.create_account(username="Romanel", password="a-password", expires_at=NOW + timedelta(days=1))
    lobby_service.create_account(username="Veytaux", password="a-password")

    assert setup_problems(lobby_service, setup, TEAMS) == [
        "an account named 'Romanel' already exists (a temporary account, expiring 2026-03-02T12:00:00+00:00)",
        "an account named 'Veytaux' already exists",
    ]


def test_a_freeplay_run_is_a_problem(lobby_service: LobbyServiceClient, setup: TeamSetup) -> None:
    setup.config_path.write_text(json.dumps({**_instance_json({"mode": "freeplay"}), "access": {"policy": "private"}}))

    assert setup_problems(lobby_service, setup, TEAMS) == [f"{SLUG} is a freeplay Run, not a workshop Run"]


def test_a_run_the_lobby_service_knows_as_freeplay_is_a_problem(
    lobby_service: LobbyServiceClient, setup: TeamSetup
) -> None:
    lobby_service.create_run(
        SLUG,
        RunCreate(name="Zurich workshop", advertised=False, starts_at=NOW, access_policy="public", mode="freeplay"),
    )

    assert setup_problems(lobby_service, setup, TEAMS) == [
        f"the lobby service has {SLUG} as a freeplay Run, not a workshop Run"
    ]


def test_a_run_without_an_instance_json_is_a_problem(lobby_service: LobbyServiceClient, setup: TeamSetup) -> None:
    setup.config_path.unlink()

    assert setup_problems(lobby_service, setup, TEAMS) == [f"there is no instance.json at {setup.config_path}"]


def test_a_run_that_already_has_teams_is_a_problem(lobby_service: LobbyServiceClient, setup: TeamSetup) -> None:
    run = {"mode": "workshop", "teams": [team.model_dump() for team in TEAMS]}
    setup.config_path.write_text(json.dumps(_instance_json(run)))
    teams = [Team(name="Alpiq", members=["Gösgen"]), Team(name="BKW", members=["Mühleberg"])]

    assert setup_problems(lobby_service, setup, teams) == [
        f"{SLUG} already has teams; remove its teams block from {setup.config_path} by hand to replace them"
    ]


def test_a_run_without_an_instance_directory_is_a_problem(lobby_service: LobbyServiceClient, setup: TeamSetup) -> None:
    setup.credentials_path.parent.rmdir()

    assert setup_problems(lobby_service, setup, TEAMS) == [
        f"there is no instance directory at {setup.credentials_path.parent}"
    ]


# --- setting up -------------------------------------------------------------------------------


def test_setting_up_creates_temporary_accounts_that_log_in_with_the_written_passwords(
    lobby_service: LobbyServiceClient, setup: TeamSetup
) -> None:
    credentials = set_up_teams(lobby_service, setup, TEAMS, expires_at=NOW + timedelta(days=7))

    assert read_credentials(setup.credentials_path, now=NOW) == credentials
    assert credentials.expires_at == NOW + timedelta(days=7)
    assert [(line.team, line.username) for line in credentials.accounts] == [
        ("Axpo", "Laufenbourg"),
        ("Axpo", "Regensdorf"),
        ("Romande Energie", "Romanel"),
        ("Romande Energie", "Veytaux"),
    ]
    for line in credentials.accounts:
        account = lobby_service.get_account_by_username(line.username)
        assert account is not None and account.expires_at is not None
        assert lobby_service.create_session(username=line.username, password=line.password)


def test_setting_up_puts_every_account_on_the_roster_and_writes_the_teams(
    lobby_service: LobbyServiceClient, setup: TeamSetup
) -> None:
    set_up_teams(lobby_service, setup, TEAMS, expires_at=NOW + timedelta(days=7))

    members = {member.username for member in lobby_service.get_run_members(SLUG)}
    assert members == {"Laufenbourg", "Regensdorf", "Romanel", "Veytaux"}
    config = read_instance_config(setup.config_path)
    assert isinstance(config.run, WorkshopRun)
    assert config.run.teams == TEAMS
    # The rest of the file is left as it was.
    assert config.name == "Zurich workshop"


def test_a_set_up_account_enters_the_run_on_its_team(
    lobby_service: LobbyServiceClient, setup: TeamSetup, tmp_path: Path
) -> None:
    set_up_teams(lobby_service, setup, TEAMS, expires_at=NOW + timedelta(days=7))
    account = lobby_service.get_account_by_username("Romanel")
    assert account is not None

    session = WorkshopSession.open(read_instance_config(setup.config_path), tmp_path / "workshop_session.json")
    player = session.join(Account(account_id=account.account_id, username=account.username))

    assert player.team == "Romande Energie"


def test_a_failure_partway_keeps_the_passwords_of_the_accounts_already_created(
    lobby_service: LobbyServiceClient, setup: TeamSetup, monkeypatch: pytest.MonkeyPatch
) -> None:
    create_account = lobby_service.create_account

    def fail_on_romanel(*, username: str, password: str, expires_at: datetime | None = None) -> CreatedAccount:
        if username == "Romanel":
            raise LobbyServiceUnavailable("timed out")
        return create_account(username=username, password=password, expires_at=expires_at)

    monkeypatch.setattr(lobby_service, "create_account", fail_on_romanel)

    with pytest.raises(LobbyServiceUnavailable):
        set_up_teams(lobby_service, setup, TEAMS, expires_at=NOW + timedelta(days=7))

    credentials = read_credentials(setup.credentials_path, now=NOW)
    assert credentials is not None
    assert [line.username for line in credentials.accounts] == ["Laufenbourg", "Regensdorf"]
    for line in credentials.accounts:
        assert lobby_service.create_session(username=line.username, password=line.password)
