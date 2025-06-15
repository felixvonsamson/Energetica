"""Define the Policy classes that are used to mimic the behavior of players in the game."""

from __future__ import annotations

from typing import Any

import numpy as np

from energetica import technology_effects
from energetica.database.player import Player
from energetica.enums import (
    ControllableFacilityType,
    FunctionalFacilityType,
    HydroFacilityType,
    ProjectType,
    WindFacilityType,
    WorkerType,
)
from energetica.game_engine import Confirm
from energetica.game_error import GameError
from energetica.globals import engine
from energetica.utils import assets


class Policy:
    """
    A policy is a strategy that the agent uses to determine the next action based on the current state.

    This is the base class for all policies.
    """

    def __init__(self, name: str):
        self.name = name
        self.is_done = False

    def take_action(self, _player: Player) -> None:
        """Every tick the policy will take an action based on the state."""
        self.is_done = True

    def __add__(self, other: Policy) -> SequencedPolicy:
        if isinstance(other, SequencedPolicy):
            return SequencedPolicy([self, *other.policies])
        if isinstance(other, Policy):
            return SequencedPolicy([self, other])
        raise ValueError("Can only add policies together")

    def __or__(self, other: Policy) -> ParallelPolicy:
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

    def take_action(self, player: Player) -> None:
        if self.is_done:
            return
        if not self.policies:
            self.is_done = True
            return
        self.policies[0].take_action(player)
        if self.policies[0].is_done:
            self.policies.pop(0)

    def __add__(self, other: Any) -> SequencedPolicy:
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

    def take_action(self, player: Player) -> None:
        for index in range(len(self.policies) - 1, -1, -1):
            self.policies[index].take_action(player)
            if self.policies[index].is_done:
                self.policies.pop(index)
        if not self.policies:
            self.is_done = True

    def __or__(self, other: Any) -> ParallelPolicy:
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

    def take_action(self, _player: Player) -> None:
        self.duration -= 1
        if self.duration <= 0:
            self.is_done = True


class QueueProjectPolicy(Policy):
    """
    A policy that queues a project in the project queue.

    It first waits for the project to be available, and for funds to be available.
    """

    def __init__(self, project_type: ProjectType, wait_for_funds: bool = True, wait_for_available_workers: bool = True):
        super().__init__(f"queue project {str(project_type)}")
        self.project_type = project_type
        self.wait_for_funds = wait_for_funds
        self.wait_for_available_workers = wait_for_available_workers

    def take_action(self, player: Player) -> None:
        if self.is_done:
            return
        try:
            assets.queue_project(player, self.project_type)
            print(f"player {player.id} queued project {self.project_type}")
            self.is_done = True
        except (GameError, Confirm):
            pass


class StarterPolicy(Policy):
    """
    A policy adopts a strategy for the early game.

    This should be the fastest / best strategy.
    """

    def __init__(self) -> None:
        super().__init__("starter policy")

    def take_action(self, player: Player) -> None:
        if self.is_done:
            return

        # Wait until all (until the) construction worker is free
        if player.available_workers(WorkerType.CONSTRUCTION) < 1:
            return

        # Check if there is enough electric capacity to support an additional level of industry
        current_industry = player.functional_facility_lvl[FunctionalFacilityType.INDUSTRY]
        const_config_assets = engine.const_config["assets"]
        next_industry_average_consumption = (
            1.2
            * const_config_assets["industry"]["base_power_consumption"]
            * const_config_assets["industry"]["power_factor"] ** (current_industry + 1)
        )
        current_capacity = sum(gen["power"] for gen in player.capacities.get_all().values())
        # print(
        #     f"player {player.id} current capacity: {int(current_capacity / 1000)}KW next industry consumption: {int(next_industry_average_consumption / 1000)} kW"
        # )
        if next_industry_average_consumption < current_capacity:
            try:
                assets.queue_project(player, FunctionalFacilityType.INDUSTRY)
                print(f"player {player.id} queued project {FunctionalFacilityType.INDUSTRY}")
                return
            except (GameError, Confirm):
                # Not enough money. Wait for funds - return early
                return

        # Not enough power capacity, build a power facility. The strategy is:
        # - Compute / estimate the LCOE for watermill, windmill, and steam engine
        # - Build the cheapest one, or wait until funds are available
        costs = {
            facility_type: (
                const_config_assets[facility_type]["base_price"]
                * technology_effects.price_multiplier(player, facility_type)
                * (
                    technology_effects.hydro_price_multiplier(player, facility_type)
                    if isinstance(facility_type, HydroFacilityType)
                    else 1.0
                )
                * const_config_assets[facility_type]["O&M_factor_per_day"]
                * 1.0
                / (
                    const_config_assets[facility_type]["base_power_generation"]
                    * technology_effects.power_production_multiplier(player, facility_type)
                )
            )
            for facility_type in (
                ControllableFacilityType.STEAM_ENGINE,
                HydroFacilityType.WATERMILL,
                WindFacilityType.WINDMILL,
            )
        }
        if WindFacilityType.WINDMILL in costs:
            wind_speed_multiplier = technology_effects.wind_speed_multiplier(player, WindFacilityType.WINDMILL)

            def capacity_factor_wind(wind_speed: float) -> float:
                """Fit of empirical data for wind speeds."""
                return 0.5280542813 - 0.5374832237 * np.exp(-2.226120465 * wind_speed**2.38728403)

            # print(f"Capacity factor wind: {capacity_factor_wind(wind_speed_multiplier)}")
            costs[WindFacilityType.WINDMILL] /= capacity_factor_wind(wind_speed_multiplier)

        if HydroFacilityType.WATERMILL in costs:
            costs[HydroFacilityType.WATERMILL] /= 0.55

        # print(", ".join(f"{facility}: {1000000 * cost:.2f}" for facility, cost in costs.items()))
        # find the cheapest facility from the dictionary costs
        while costs:
            cheapest_facility = min(costs, key=lambda key: costs[key])
            try:
                assets.queue_project(player, cheapest_facility)
                print(f"player {player.id} queued project {cheapest_facility}")
                return
            except Confirm:
                # Not enough power! Try the next cheapest facility
                costs.pop(cheapest_facility)
                continue
            except GameError:
                # Not enough money. Wait for funds - return early
                return
            # The policy is done
