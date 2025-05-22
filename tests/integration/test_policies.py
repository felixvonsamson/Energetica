from energetica.database.active_facility import ActiveFacility
from energetica.database.ongoing_project import OngoingProject
from energetica.enums import ControllableFacilityType, FunctionalFacilityType, HydroFacilityType, WindFacilityType
from tests.policy import QueueProjectPolicy, StarterPolicy
from tests.policy_runner import run_policies


def test_build_one_steam_engine() -> None:
    """Test building one steam engine."""
    policy = QueueProjectPolicy(ControllableFacilityType.STEAM_ENGINE)
    players = run_policies([policy], ticks_to_run=10)
    assert OngoingProject.count_when(player=players[0]) == 1


def test_starter_policy() -> None:
    """Test the starter policy."""
    policy = StarterPolicy()
    players = run_policies([policy], ticks_to_run=100)
    player = players[0]
    print(f"Industry: {player.functional_facility_lvl[FunctionalFacilityType.INDUSTRY]}")
    print(
        f"Steam engines: {ActiveFacility.count_when(player=player, facility_type=ControllableFacilityType.STEAM_ENGINE)}",
    )
    print(f"Watermills: {ActiveFacility.count_when(player=player, facility_type=HydroFacilityType.WATERMILL)}")
    print(f"Windmills: {ActiveFacility.count_when(player=player, facility_type=WindFacilityType.WINDMILL)}")
    assert (
        player.functional_facility_lvl[FunctionalFacilityType.INDUSTRY]
        + OngoingProject.count_when(player=player, project_type=FunctionalFacilityType.INDUSTRY)
        >= 5
    )


# def test_build_ten_steam_engines():
#     """Test building ten steam engines"""
#     policy = (
#         QueueProjectPolicy(ControllableFacilityType.STEAM_ENGINE)
#         + QueueProjectPolicy(ControllableFacilityType.STEAM_ENGINE)
#         + QueueProjectPolicy(ControllableFacilityType.STEAM_ENGINE)
#         + QueueProjectPolicy(ControllableFacilityType.STEAM_ENGINE)
#         # + QueueProjectPolicy(ControllableFacilityType.STEAM_ENGINE)
#         # + QueueProjectPolicy(ControllableFacilityType.STEAM_ENGINE)
#         # + QueueProjectPolicy(ControllableFacilityType.STEAM_ENGINE)
#         # + QueueProjectPolicy(ControllableFacilityType.STEAM_ENGINE)
#         # + QueueProjectPolicy(ControllableFacilityType.STEAM_ENGINE)
#         # + QueueProjectPolicy(ControllableFacilityType.STEAM_ENGINE)
#     )
#     players = run_policies([policy])
#     assert OngoingProject.count_when(player=players[0]) + ActiveFacility.count_when(player=players[0]) == 10
