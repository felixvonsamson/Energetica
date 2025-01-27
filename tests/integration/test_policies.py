from energetica.database.ongoing_project import OngoingProject
from energetica.enums import ControllableFacilityType
from tests.policy import QueueProjectPolicy
from tests.policy_runner import run_policies


def test_build_one_steam_engine():
    """Test building one steam engine"""
    policy = QueueProjectPolicy(ControllableFacilityType.STEAM_ENGINE)
    players = run_policies([policy])
    assert OngoingProject.count_when(player=players[0]) == 1
