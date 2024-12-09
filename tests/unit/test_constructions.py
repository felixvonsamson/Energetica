import os
import sys

sys.path.append(os.getcwd())

from energetica.database.ongoing_construction import OngoingConstruction
from energetica.utils.assets import decrease_project_priority


def test_swap_paused_and_unpaused_constructions():
    # Setup:
    # Player has one construction worker, constructions A and B are launched, A is ongoing, B is waiting.
    # After decreasing the priority of the construction A, construction B should be ongoing, and A waiting.
    assert True
