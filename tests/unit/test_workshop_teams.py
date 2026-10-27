"""Workshop teams (#1384): the config that sets them, entering a Run with teams, and the team scores."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from energetica.identity.account import Account
from energetica.identity.instance_config import InstanceConfig, Team, WorkshopRun
from energetica.workshop.facilities import FacilityId
from energetica.workshop.session import Finished, NotOnATeamError, WorkshopSession
from energetica.workshop.trading import FacilityPerformance, TradingResult

AXPO = {"name": "Axpo", "members": ["laufenbourg", "regensdorf"]}
ROMANDE = {"name": "Romande Energie", "members": ["romanel", "veytaux"]}


def _config(teams: list[dict[str, Any]] | None = None) -> InstanceConfig:
    run: dict[str, Any] = {"mode": "workshop"}
    if teams is not None:
        run["teams"] = teams
    return InstanceConfig.model_validate(
        {"name": "Workshop", "advertised": False, "starts_at": "2026-03-01T00:00:00Z", "run": run}
    )


def _teams(config: InstanceConfig) -> list[Team] | None:
    assert isinstance(config.run, WorkshopRun)
    return config.run.teams


def _account(account_id: int, username: str) -> Account:
    return Account(account_id=account_id, username=username)


def _result(round_number: int, revenue: float) -> TradingResult:
    performance = FacilityPerformance(
        generation=0.0,
        sold=0.0,
        dumped=0.0,
        bought=0.0,
        revenue=revenue,
        dump_cost=0.0,
        purchase_cost=0.0,
        om=0.0,
        emissions=0.0,
        capacity_factor=0.0,
    )
    return TradingResult(
        round=round_number,
        season="spring",
        facilities={FacilityId.GAS_BURNER: performance},
        carbon_tax_rate=0.0,
        carbon_tax_share=0.0,
    )


@pytest.fixture
def path(tmp_path: Path) -> Path:
    return tmp_path / "workshop_session.json"


# --- the config -----------------------------------------------------------------------------


def test_a_run_without_teams_has_none() -> None:
    assert _teams(_config()) is None


def test_teams_are_read_in_the_order_written() -> None:
    config = _config([AXPO, ROMANDE])

    assert _teams(config) == [
        Team(name="Axpo", members=["laufenbourg", "regensdorf"]),
        Team(name="Romande Energie", members=["romanel", "veytaux"]),
    ]


@pytest.mark.parametrize(
    "teams",
    [
        pytest.param([AXPO], id="one team"),
        pytest.param([], id="no teams"),
        pytest.param([AXPO, {"name": "Romande Energie", "members": ["romanel"]}], id="uneven sizes"),
        pytest.param([{"name": "Axpo", "members": []}, {"name": "Romande Energie", "members": []}], id="empty teams"),
        pytest.param([AXPO, {"name": "", "members": ["romanel", "veytaux"]}], id="empty name"),
        pytest.param([AXPO, {"name": "Axpo", "members": ["romanel", "veytaux"]}], id="same name"),
        pytest.param([AXPO, {"name": "Romande Energie", "members": ["romanel", "regensdorf"]}], id="shared member"),
        pytest.param([{"name": "Axpo", "members": ["bex", "bex"]}, ROMANDE], id="member twice in a team"),
    ],
)
def test_a_malformed_team_list_rejects_the_file(teams: list[dict[str, Any]]) -> None:
    with pytest.raises(ValidationError):
        _config(teams)


# --- entering -------------------------------------------------------------------------------


def test_without_teams_a_player_has_no_team(path: Path) -> None:
    session = WorkshopSession.open(_config(), path)

    assert session.join(_account(1, "alice")).team is None


def test_a_player_enters_on_their_team(path: Path) -> None:
    session = WorkshopSession.open(_config([AXPO, ROMANDE]), path)

    assert session.join(_account(1, "veytaux")).team == "Romande Energie"


def test_an_account_on_no_team_cannot_enter_a_run_with_teams(path: Path) -> None:
    session = WorkshopSession.open(_config([AXPO, ROMANDE]), path)

    with pytest.raises(NotOnATeamError):
        session.join(_account(1, "alice"))

    assert session.network.players() == []


def test_a_player_keeps_their_team_after_a_restart(path: Path) -> None:
    WorkshopSession.open(_config([AXPO, ROMANDE]), path).join(_account(1, "romanel"))

    reopened = WorkshopSession.open(_config([AXPO, ROMANDE]), path)

    player = reopened.player(1)
    assert player is not None
    assert player.team == "Romande Energie"


def test_a_renamed_account_keeps_the_team_it_entered_on(path: Path) -> None:
    session = WorkshopSession.open(_config([AXPO, ROMANDE]), path)
    session.join(_account(1, "romanel"))

    player = session.join(_account(1, "laufenbourg"))

    assert player.team == "Romande Energie"


def test_editing_the_file_does_not_move_a_player_who_has_entered(path: Path) -> None:
    WorkshopSession.open(_config([AXPO, ROMANDE]), path).join(_account(1, "romanel"))
    moved = {"name": "Axpo", "members": ["laufenbourg", "romanel"]}

    reopened = WorkshopSession.open(
        _config([moved, {"name": "Romande Energie", "members": ["regensdorf", "veytaux"]}]), path
    )

    assert reopened.join(_account(1, "romanel")).team == "Romande Energie"


# --- the scoreboard -------------------------------------------------------------------------


def test_without_teams_the_scoreboard_has_no_team_ranking(path: Path) -> None:
    session = WorkshopSession.open(_config(), path)
    session.join(_account(1, "alice"))

    board = session.scoreboard()

    assert board.teams is None
    assert board.scores[0].team is None


def test_each_score_names_the_players_team(path: Path) -> None:
    session = WorkshopSession.open(_config([AXPO, ROMANDE]), path)
    session.join(_account(1, "laufenbourg"))

    assert session.scoreboard().scores[0].team == "Axpo"


def test_a_team_scores_the_sum_of_its_members_and_ranks_highest_first(path: Path) -> None:
    session = WorkshopSession.open(_config([AXPO, ROMANDE]), path, round_count=1)
    session.join(_account(1, "laufenbourg")).trading_results = [_result(1, 100.0)]
    session.join(_account(2, "regensdorf")).trading_results = [_result(1, 200.0)]
    session.join(_account(3, "romanel")).trading_results = [_result(1, 500.0)]
    session.join(_account(4, "veytaux")).trading_results = [_result(1, 50.0)]
    _finish(session)

    teams = session.scoreboard().teams

    assert teams is not None
    assert [(team.name, team.score, team.operating_profit) for team in teams] == [
        ("Romande Energie", 550.0, 550.0),
        ("Axpo", 300.0, 300.0),
    ]
    assert teams[0].account_ids == [3, 4]


def test_a_team_whose_members_never_entered_scores_nothing(path: Path) -> None:
    session = WorkshopSession.open(_config([AXPO, ROMANDE]), path, round_count=1)
    session.join(_account(1, "laufenbourg")).trading_results = [_result(1, 100.0)]
    _finish(session)

    teams = session.scoreboard().teams

    assert teams is not None
    assert [(team.name, team.score, team.account_ids) for team in teams] == [
        ("Axpo", 100.0, [1]),
        ("Romande Energie", 0.0, []),
    ]


def test_teams_on_the_same_score_keep_the_order_in_the_file(path: Path) -> None:
    session = WorkshopSession.open(_config([AXPO, ROMANDE]), path, round_count=1)
    _finish(session)

    teams = session.scoreboard().teams

    assert teams is not None
    assert [team.name for team in teams] == ["Axpo", "Romande Energie"]


def _finish(session: WorkshopSession) -> None:
    """Mark every Round completed, so every Trading result counts."""
    session.checkpoint = Finished()
