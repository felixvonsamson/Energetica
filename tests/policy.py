"""This module ..."""

from __future__ import annotations

from energetica.database import Player
from energetica.enums import ControllableFacilityType, ProjectType
from energetica.game_engine import Confirm, GameEngine
from energetica.game_error import GameError
from energetica.utils import assets


class Policy:
    """
    A policy is a strategy that the agent uses to determine the next action based on the current state.

    This is the base class for all policies.
    """

    def __init__(self, name: str):
        self.name = name
        self.is_done = True

    def take_action(self, _player: Player, _game_engine: GameEngine) -> None:
        """Every tick the policy will take an action based on the state"""
        self.is_done = True

    def __add__(self, other) -> SequencedPolicy:
        if isinstance(other, SequencedPolicy):
            return SequencedPolicy([self, *other.policies])
        if isinstance(other, Policy):
            return SequencedPolicy([self, other])
        raise ValueError("Can only add policies together")

    def __or__(self, other) -> ParallelPolicy:
        if isinstance(other, ParallelPolicy):
            return ParallelPolicy([self, *other.policies])
        if isinstance(other, Policy):
            return ParallelPolicy([self, other])
        raise ValueError("Can only or policies together")


class SequencedPolicy(Policy):
    """
    A policy that executes a sequence of policies.

    The first policy is executed until it is done, then the next policy is executed, and so on.
    The policy is done when the last policy is done.
    """

    def __init__(self, policies: list[Policy]):
        super().__init__(", then ".join([policy.name for policy in policies]))
        self.policies = policies

    def take_action(self, player: Player, game_engine: GameEngine) -> None:
        if self.is_done:
            return
        if not self.policies:
            self.is_done = True
            return
        self.policies[0].take_action(player, game_engine)
        if self.policies[0].is_done:
            self.policies.pop(0)

    def __add__(self, other) -> SequencedPolicy:
        if isinstance(other, SequencedPolicy):
            return SequencedPolicy([*self.policies, *other.policies])
        if isinstance(other, Policy):
            return SequencedPolicy([*self.policies, other])
        raise ValueError("Can only add policies together")


class ParallelPolicy(Policy):
    """
    A policy that executes a sequence of policies in parallel.

    All policies are executed each tick. The policy is done when all policies are done.
    """

    def __init__(self, policies: list[Policy]):
        super().__init__(", then ".join([policy.name for policy in policies]))
        self.policies = policies

    def take_action(self, player: Player, game_engine: GameEngine) -> None:
        for index in range(len(self.policies) - 1, -1, -1):
            self.policies[index].take_action(player, game_engine)
            if self.policies[index].is_done:
                self.policies.pop(index)
        if not self.policies:
            self.is_done = True

    def __or__(self, other) -> ParallelPolicy:
        if isinstance(other, ParallelPolicy):
            return ParallelPolicy([*self.policies, *other.policies])
        if isinstance(other, Policy):
            return ParallelPolicy([*self.policies, other])
        raise ValueError("Can only or policies together")


class WaitPolicy(Policy):
    """A policy that does nothing for a certain number of ticks before it is done."""

    def __init__(self, duration: int):
        super().__init__(f"wait {duration} ticks")
        self.duration = duration

    def take_action(self, _player: Player, _game_engine: GameEngine) -> None:
        self.duration -= 1
        if self.duration <= 0:
            self.is_done = True


class QueueProjectPolicy(Policy):
    """
    A policy that queues a project in the project queue.

    It first waits for the project to be available, and for funds to be available.
    """

    def __init__(self, project_type: ProjectType, wait_for_funds: bool = True, wait_for_available_workers: bool = True):
        super().__init__(f"queue project {project_type.name}")
        self.project_type = project_type
        self.wait_for_funds = wait_for_funds
        self.wait_for_available_workers = wait_for_available_workers

    def take_action(self, player: Player, _game_engine: GameEngine) -> None:
        if self.is_done:
            return
        try:
            assets.queue_project(player, self.project_type)
            self.is_done = True
        except (GameError, Confirm):
            pass


example_policy = WaitPolicy(5) + QueueProjectPolicy(ControllableFacilityType.STEAM_ENGINE)

player_a_policy = WaitPolicy(5) + QueueProjectPolicy(ControllableFacilityType.STEAM_ENGINE)
player_b_policy = QueueProjectPolicy(ControllableFacilityType.STEAM_ENGINE)
