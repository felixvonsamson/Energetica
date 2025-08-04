"""Contains the classes that define the players and networks."""

from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from dataclasses import dataclass, field
from enum import StrEnum
from functools import cached_property
from typing import TYPE_CHECKING, Any, Iterable

from pywebpush import WebPushException, webpush

from energetica.config.achievements import achievements
from energetica.database import DBModel
from energetica.database.active_facility import ActiveFacility
from energetica.database.engine_data import CapacityData, CircularBufferPlayer, CumulativeEmissionsData, NetworkPrices
from energetica.database.messages import Chat, Notification
from energetica.database.ongoing_project import OngoingProject
from energetica.database.shipment import OngoingShipment
from energetica.enums import (
    ExtractionFacilityType,
    Fuel,
    FunctionalFacilityType,
    PowerFacilityType,
    ProjectStatus,
    ProjectType,
    StorageFacilityType,
    TechnologyType,
    WindFacilityType,
    WorkerType,
)
from energetica.globals import MAIN_EVENT_LOOP, engine
from energetica.schemas.achievements import AchievementOut
from energetica.technology_effects import (
    package_available_technologies,
    package_extraction_facilities,
    package_functional_facilities,
    package_power_facilities,
    package_storage_facilities,
)

if TYPE_CHECKING:
    from collections.abc import Iterator

    from energetica.database.map import HexTile
    from energetica.database.network import Network


@dataclass
# TODO (Felix): add @dataclass(eq=False) on all classes
class Player(DBModel):
    """Class that stores the users and their data."""

    # Authentication :
    username: str
    pwhash: str
    is_admin: bool = False

    # inactive: bool = False  # True if account is inactive
    show_chat_disclaimer: bool = True
    last_opened_chat_id: int = field(default_factory=lambda: engine.general_chat.id)

    tile: HexTile | None = None
    network: Network | None = None

    # TODO (Felix): Modify the post__init__ of DBModel to store the following objects in engine or in the player
    projects_by_priority: dict[WorkerType, list[OngoingProject]] = field(
        default_factory=lambda: {worker_type: [] for worker_type in WorkerType},
    )

    @property
    def constructions_by_priority(self) -> list[OngoingProject]:
        """Return the constructions by priority."""
        return self.projects_by_priority[WorkerType.CONSTRUCTION]

    @property
    def researches_by_priority(self) -> list[OngoingProject]:
        """Return the researches by priority."""
        return self.projects_by_priority[WorkerType.RESEARCH]

    @property
    def notifications(self) -> list[Notification]:
        """Return the notifications of the player."""
        return list(Notification.filter_by(player=self))

    network_prices: NetworkPrices = field(default_factory=NetworkPrices)
    rolling_history: CircularBufferPlayer = field(default_factory=CircularBufferPlayer)
    capacities: CapacityData = field(default_factory=CapacityData)
    cumul_emissions: CumulativeEmissionsData = field(default_factory=CumulativeEmissionsData)

    achievements: dict[str, int] = field(
        default_factory=lambda: {
            "power_consumption": 0,
            "energy_storage": 0,
            "mineral_extraction": 0,
            "network_import": 0,
            "network_export": 0,
            "technology": 0,
            "trading_export": 0,
            "trading_import": 0,
            "network": 0,
            "laboratory": 0,
            "warehouse": 0,
            "GHG_effect": 0,
            "storage_facilities": 0,
        },
    )

    # TODO(mglst): create a custom class for this - some fields are not floats
    progression_metrics: dict[str, float] = field(
        default_factory=lambda: {
            "xp": 0,
            "average_revenues": 0,
            "max_power_consumption": 0,
            "max_energy_stored": 0,
            "extracted_resources": 0,
            "bought_resources": 0,
            "sold_resources": 0,
            "total_technologies": 0,
            "imported_energy": 0,
            "exported_energy": 0,
            "captured_co2": 0,
        },
    )

    # Browser notifications & preferences
    # TODO(mglst): type annotation seems wrong. is it not a dictionary?
    notification_subscriptions: list = field(default_factory=list)
    notification_preferences: dict = field(
        default_factory=lambda: {
            "messages": True,
            "achievements": True,
            "projects": True,
            "decommissioning": True,
            "resource_market": True,
            "climate_events": True,
        },
    )
    socketio_clients: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        """Post initialization method for Player."""
        super().__post_init__()
        self.network_prices.init_prices_with_randomness(self)

    def __hash__(self) -> int:
        """Return the hash of the player's id."""
        return hash(self.id)

    def get_level(self, functional_facility_or_technology: ProjectType) -> int:
        """Return the technology or functional facility level of the player."""
        if isinstance(functional_facility_or_technology, FunctionalFacilityType):
            return self.functional_facility_lvl[functional_facility_or_technology]
        if isinstance(functional_facility_or_technology, TechnologyType):
            return self.technology_lvl[functional_facility_or_technology]
        assert False, "Wrong requirement name"

    class NetworkGraphView(StrEnum):
        """Enum for the network graph view of the player."""

        BASIC = "basic"
        NORMAL = "normal"
        EXPERT = "expert"

    # misc :
    graph_view: str = NetworkGraphView.BASIC

    # resources :
    money: float = 25000
    resources: dict[Fuel, float] = field(default_factory=lambda: {fuel: 0 for fuel in Fuel})
    resources_on_sale: dict[Fuel, float] = field(default_factory=lambda: {fuel: 0 for fuel in Fuel})

    workers: dict[WorkerType, int] = field(
        default_factory=lambda: {
            WorkerType.CONSTRUCTION: 1,
            WorkerType.RESEARCH: 0,
        },
    )

    functional_facility_lvl: dict[FunctionalFacilityType, int] = field(
        default_factory=lambda: {
            FunctionalFacilityType.INDUSTRY: 1,
            FunctionalFacilityType.LABORATORY: 0,
            FunctionalFacilityType.WAREHOUSE: 0,
            FunctionalFacilityType.CARBON_CAPTURE: 0,
        },
    )

    technology_lvl: dict[TechnologyType, int] = field(
        default_factory=lambda: {tech: 0 for tech in TechnologyType},
    )

    @property
    def config(self) -> dict:
        """Return the player's configuration."""
        return engine.config[self]

    @cached_property
    def power_facilities_data(self) -> list:
        """Cached property that stores the power facilities data of a player."""
        return package_power_facilities(self)

    @cached_property
    def storage_facilities_data(self) -> list:
        """Cached property that stores the storage facilities data of a player."""
        return package_storage_facilities(self)

    @cached_property
    def extraction_facilities_data(self) -> list:
        """Cached property that stores the extraction facilities data of a player."""
        return package_extraction_facilities(self)

    @cached_property
    def functional_facilities_data(self) -> list:
        """Cached property that stores the functional facilities data of a player."""
        return package_functional_facilities(self)

    @cached_property
    def technologies_data(self) -> list:
        """Cached property that stores the technologies data of a player."""
        return package_available_technologies(self)

    @property
    def is_in_network(self) -> bool:
        """Return True if the player is in a network."""
        return self.network is not None

    def change_graph_view(self, view: NetworkGraphView) -> None:
        """Set the network graph view of the player (basic/normal/expert)."""
        self.graph_view = view

    def available_workers(self, worker_type: WorkerType) -> int:
        """Return the number of available workers depending on the project type."""
        occupied_workers = OngoingProject.count_when(player=self, worker_type=worker_type, status=ProjectStatus.ONGOING)
        return self.workers[worker_type] - occupied_workers

    def package_chat_messages(self, chat: Chat) -> list[dict]:
        """Package the last 20 messages of a chat."""
        messages_list = [
            {
                "time": message.timestamp.isoformat(),
                "player_id": message.player.id,
                "text": message.text,
            }
            for message in chat.messages[-20:]
        ]
        return messages_list

    def mark_chat_as_read(self, chat: Chat) -> None:
        """Mark a chat as read."""
        self.last_opened_chat_id = chat.id
        chat.player_last_read_index[self.id] = len(chat.messages) - 1

    def unread_chat_count(self) -> int:
        """Return the number of unread chats."""
        return Chat.count(
            condition=lambda chat: self in chat.participants and chat.unread_messages_count_for_player(self) > 0,
        )

    def package_chats(self) -> dict:
        """Package chats for the iOS frontend."""
        # TODO: unify the two package_chat methods
        return {
            chat.id: {
                "id": chat.id,
                "name": chat.name,  # can be None
                "participants": [player.id for player in chat.participants],
                "older_messages_exist": len(chat.messages) > 20,
                "messages": [message.package() for message in chat.messages[-20:]],
            }
            for chat in Chat.filter(lambda chat: self in chat.participants)
        }

    def delete_notification(self, notification: Notification) -> None:
        """Delete a notification."""
        if notification.player == self:
            notification.delete()

    def notifications_read(self) -> None:
        """Mark all notifications as read."""
        for notification in self.unread_notifications():
            notification.read = True

    def unread_notifications(self) -> list[Notification]:
        """Return all unread notifications."""
        return list(filter(lambda notification: not notification.read, self.notifications))

    def get_lvls(self) -> dict[FunctionalFacilityType | TechnologyType, int]:
        """Return the levels of functional facilities and technologies of a player."""
        return self.technology_lvl | self.functional_facility_lvl

    def emit(self, event: str, *args: Any) -> None:
        """Emit a socketio event to the player's clients."""
        for sid in self.socketio_clients:
            asyncio.run_coroutine_threadsafe(engine.socketio.emit(event, *args, to=sid), MAIN_EVENT_LOOP)

    def send_new_data(self, new_values: Any) -> None:
        """Send the new data to the player's clients."""
        construction_updates = self.get_construction_updates()
        shipment_updates = self.get_shipment_updates()
        self.emit(
            "new_values",
            {
                "total_t": engine.total_t,
                "chart_values": new_values,
                "climate_values": engine.current_climate_data.get_last_data(),
                "cumulative_emissions": self.cumul_emissions.get_all(),
                "money": self.money,
                "construction_updates": construction_updates,
                "shipment_updates": shipment_updates,
            },
        )

    def get_construction_updates(self) -> dict:
        """
        Return a dictionary of the constructions for which the progress speed has changed.

        For each of these constructions, the dictionary contains the new speed and the new end_tick.
        """
        player_constructions: Iterator[OngoingProject] = OngoingProject.filter_by(
            player=self,
            status=ProjectStatus.ONGOING,
        )
        construction_speeds: dict = {}
        for construction in player_constructions:
            new_speed = construction.updated_speed()
            if new_speed is not None:
                construction_speeds[construction.id] = {
                    "speed": new_speed,
                    "end_tick": construction.end_tick_or_ticks_passed,
                }
        return construction_speeds

    def get_shipment_updates(self) -> dict:
        """
        Return a dictionary of the shipments for which the progress speed has changed.

        For each of these shipments, the dictionary contains the new speed and the new arrival_tick.
        """
        player_shipments: Iterator[OngoingShipment] = OngoingShipment.filter_by(player=self)
        shipment_speeds: dict = {}
        for shipment in player_shipments:
            new_speed = shipment.updated_speed()
            if new_speed is not None:
                shipment_speeds[shipment.id] = {
                    "speed": new_speed,
                    "arrival_tick": shipment.arrival_tick,
                }
        return shipment_speeds

    def notify(self, title: str, message: str) -> None:
        """
        Create a notification.

        This has three effects:
        1. It creates a new notification object in the database.
        2. It emits the notification over socketio to the player's active web clients.
        3. It sends the notification using webpush to the player's subscribed browser(s).
        """
        new_notification = Notification(title=title, content=message, player=self)
        self.emit(
            "new_notification",
            {
                "id": new_notification.id,
                "time": str(new_notification.time),
                "title": new_notification.title,
                "content": new_notification.content,
            },
        )
        if (  # This probably doesn't work anymore
            self.notifications
            and new_notification.content == self.notifications[len(self.notifications) - 2].content
            and new_notification.time == self.notifications[len(self.notifications) - 2].time
        ):
            return
        notification_data = {
            "title": new_notification.title,
            "body": new_notification.content,
        }
        for subscription in self.notification_subscriptions:
            audience = "https://fcm.googleapis.com"
            if "https://updates.push.services.mozilla.com" in subscription["endpoint"]:
                audience = "https://updates.push.services.mozilla.com"
            try:
                webpush(
                    subscription_info=subscription,
                    data=json.dumps(notification_data),
                    vapid_private_key=engine.VAPID_PRIVATE_KEY,
                    vapid_claims={"aud": audience},
                )
            except WebPushException as ex:
                engine.warn(f"Failed to send notification: {repr(ex)}")

    def send_worker_info(self) -> None:
        """Send the number of available construction and lab workers to the player's clients."""
        self.emit(
            "worker_info",
            {
                "construction": {
                    "available": self.available_workers(WorkerType.CONSTRUCTION),
                    "total": self.workers[WorkerType.CONSTRUCTION],
                },
                "laboratory": {
                    "available": self.available_workers(WorkerType.RESEARCH),
                    "total": self.workers[WorkerType.RESEARCH],
                },
            },
        )

    def calculate_net_emissions(self) -> float:
        """Calculate the net emissions of the player."""
        cumulative_emissions = self.cumul_emissions.get_all()
        net_emissions: float = 0
        for value in cumulative_emissions.values():
            net_emissions += value
        return net_emissions

    def discovered_greenhouse_gas_effect(self) -> bool:
        """Return True if the player has discovered the greenhouse gas effect."""
        return bool(self.achievements["GHG_effect"])

    def check_continuous_achievements(self) -> None:
        """Check for player achievements that are linked to values that are updated every tick."""
        for achievement in [
            "power_consumption",
            "energy_storage",
            "mineral_extraction",
            "network_import",
            "network_export",
            "network",
        ]:
            current_lvl = self.achievements[achievement]
            achievement_data = achievements[achievement]
            if (
                current_lvl < len(achievement_data["milestones"])
                and self.progression_metrics[achievement_data["metric"]] >= achievement_data["milestones"][current_lvl]
            ):
                self.achievements[achievement] += 1
                self.progression_metrics["xp"] += achievement_data["rewards"][current_lvl]
                message = achievement_data["message"]
                if achievement == "network":
                    message = message.format(reward=achievement_data["rewards"][current_lvl])
                elif "comparisons" in achievement_data:
                    message = message.format(
                        value=achievement_data["milestones"][current_lvl],
                        reward=achievement_data["rewards"][current_lvl],
                        comparison=achievement_data["comparisons"][current_lvl],
                    )
                else:
                    message = message.format(
                        value=achievement_data["milestones"][current_lvl],
                        reward=achievement_data["rewards"][current_lvl],
                    )
                self.notify("Achievement", message)

    def check_construction_achievements(self, construction_name: str) -> None:
        """Check for player achievements that may be unlocked by a construction."""
        for achievement in ["laboratory", "warehouse", "GHG_effect", "storage_facilities"]:
            if not self.achievements[achievement] and construction_name in achievements[achievement]["unlocked_with"]:
                self.achievements[achievement] = 1
                self.progression_metrics["xp"] += achievements[achievement]["reward"]
                message = achievements[achievement]["message"].format(reward=achievements[achievement]["reward"])
                self.notify("Achievement", message)

    def check_technology_achievement(self) -> None:
        """Check for technology achievement."""
        current_lvl = self.achievements["technology"]
        achievement_data = achievements["technology"]
        if (
            current_lvl < len(achievement_data["milestones"])
            and self.progression_metrics[achievement_data["metric"]] >= achievement_data["milestones"][current_lvl]
        ):
            self.achievements["technology"] += 1
            self.progression_metrics["xp"] += achievement_data["rewards"][current_lvl]
            message = achievements["technology"]["message"].format(
                value=achievement_data["milestones"][current_lvl],
                reward=achievements["technology"]["rewards"][current_lvl],
            )
            self.notify("Achievement", message)

    def check_trading_achievement(self) -> None:
        """Check for trading achievement."""
        for achievement in ["trading_export", "trading_import"]:
            current_lvl = self.achievements[achievement]
            achievement_data = achievements[achievement]
            if (
                current_lvl < len(achievement_data["milestones"])
                and self.progression_metrics[achievement_data["metric"]] >= achievement_data["milestones"][current_lvl]
            ):
                self.achievements[achievement] += 1
                self.progression_metrics["xp"] += achievement_data["rewards"][current_lvl]
                message = achievement_data["message"].format(
                    value=achievement_data["milestones"][current_lvl],
                    reward=achievement_data["rewards"][current_lvl],
                )
                self.notify("Achievement", message)

    def package_upcoming_achievements(self) -> list[AchievementOut]:
        """Package the progress information for the upcoming achievements."""
        upcoming_achievements: list[AchievementOut] = []
        for achievement_id, achievement_data in achievements.items():
            requirements_met = all(self.achievements[requirement] for requirement in achievement_data["requirements"])
            if not requirements_met:
                continue
            if achievement_id in ["laboratory", "warehouse", "GHG_effect", "storage_facilities"]:
                if not self.achievements[achievement_id]:
                    achievement = AchievementOut(
                        id=achievement_id,
                        name=achievement_data["name"],
                        reward=achievement_data["reward"],
                        objective=1,
                        status=0,
                    )
                    upcoming_achievements.append(achievement)
            else:
                current_lvl = self.achievements[achievement_id]
                if current_lvl < len(achievement_data["milestones"]):
                    status = self.progression_metrics[achievement_data["metric"]]
                    achievement = AchievementOut(
                        id=achievement_id,
                        name=f"{achievement_data['name']} {current_lvl + 1}",
                        reward=achievement_data["rewards"][current_lvl],
                        objective=achievement_data["milestones"][current_lvl],
                        status=round(status),
                    )
                    upcoming_achievements.append(achievement)
        return upcoming_achievements

    def __repr__(self) -> str:
        """Return the player's username as a string for debugging."""
        return f"<Player {self.id} '{self.username}'>"

    def package(self) -> dict:
        """Package select attributes of self to a dictionary."""
        return (
            {
                "id": self.id,
                "username": self.username,
            }
            | ({"network_id": self.network.id} if self.network is not None else {})
            | ({"cell_id": self.tile.id} if self.tile is not None else {})
        )

    # TODO(mglst): this method should be deprecated
    @staticmethod
    def package_all() -> dict[int, dict]:
        """Package data for all players."""
        return {player.id: player.package() for player in Player.all()}

    def package_shipments(self) -> dict[int, dict]:
        """Package the player's ongoing shipments."""
        return {
            shipment.id: {
                k: getattr(shipment, k)
                for k in [
                    "id",
                    "resource",
                    "quantity",
                    "arrival_tick",
                    "duration",
                ]
            }
            for shipment in OngoingShipment.filter_by(player=self)
        }

    def package_construction_queue(self) -> list:
        """Package the player's construction queue (list of construction_ids)."""
        return self.constructions_by_priority

    @property
    def power_facilities(self) -> Iterable[ActiveFacility]:
        return ActiveFacility.filter(
            lambda active_facility: active_facility.player == self
            and isinstance(active_facility.facility_type, PowerFacilityType),
        )

    @property
    def storage_facilities(self) -> Iterable[ActiveFacility]:
        return ActiveFacility.filter(
            lambda active_facility: active_facility.player == self
            and isinstance(active_facility.facility_type, StorageFacilityType),
        )

    @property
    def extraction_facilities(self) -> Iterable[ActiveFacility]:
        return ActiveFacility.filter(
            lambda active_facility: active_facility.player == self
            and isinstance(active_facility.facility_type, ExtractionFacilityType),
        )

    def package_active_facilities(self) -> dict[str, dict[int, dict[str, Any]]]:
        """Package the player's active facilities."""
        return {
            "power_facilities": self.package_active_power_facilities(),
            "storage_facilities": self.package_active_storage_facilities(),
            "extraction_facilities": self.package_active_extraction_facilities(),
        }

    def package_active_power_facilities(self) -> dict:
        """Package the player's active power facilities."""
        ticks_per_hour = 3600 / engine.in_game_seconds_per_tick
        active_power_facilities = [
            active_facility
            for active_facility in ActiveFacility.filter_by(player=self)
            if isinstance(active_facility.facility_type, PowerFacilityType)
        ]
        power_facility_groups: dict[str, list[ActiveFacility]] = defaultdict(list)
        for power_facility in active_power_facilities:
            power_facility_groups[power_facility.facility_type].append(power_facility)
        return {
            "summary": {
                group_name: {
                    "display_name": engine.const_config["assets"][group_name]["name"],
                    "count": len(group),
                    "installed_cap": self.capacities[group_name]["power"],
                    "usage": sum(f.usage * f.max_power_generation for f in group)
                    / sum(f.max_power_generation for f in group),
                    "hourly_op_cost": self.capacities[group_name]["O&M_cost"] * ticks_per_hour,
                    "remaining_lifespan": min(f.remaining_lifespan for f in group if f.remaining_lifespan is not None),
                    "upgrade_cost": sum(f.upgrade_cost for f in group if f.is_upgradable and f.upgrade_cost is not None)
                    if any(f.is_upgradable for f in group)
                    else None,
                    "dismantle_cost": sum(f.dismantle_cost for f in group),
                }
                | (
                    {"cut_out_speed_exceeded": any(f.cut_out_speed_exceeded for f in group)}
                    if isinstance(group_name, WindFacilityType)
                    else {}
                )
                for group_name, group in power_facility_groups.items()
            },
            "detail": {
                power_facility.id: {
                    "facility": power_facility.facility_type,
                    "display_name": power_facility.display_name,
                    "installed_cap": power_facility.max_power_generation,
                    "usage": power_facility.usage,
                    "hourly_op_cost": power_facility.hourly_op_cost,
                    "remaining_lifespan": power_facility.remaining_lifespan,
                    "upgrade_cost": power_facility.upgrade_cost,
                    "dismantle_cost": power_facility.dismantle_cost,
                }
                | (
                    {"cut_out_speed_exceeded": power_facility.cut_out_speed_exceeded}
                    if isinstance(power_facility.facility_type, WindFacilityType)
                    else {}
                )
                for power_facility in active_power_facilities
            },
        }

    def package_active_storage_facilities(self) -> dict:
        """Package active storage facilities."""
        ticks_per_hour = 3600 / engine.in_game_seconds_per_tick
        capacities = self.capacities
        active_storage_facilities = [
            active_facility
            for active_facility in ActiveFacility.filter_by(player=self)
            if isinstance(active_facility.facility_type, StorageFacilityType)
        ]
        storage_facility_groups: dict[str, list[ActiveFacility]] = defaultdict(list)
        for storage_facility in active_storage_facilities:
            storage_facility_groups[storage_facility.facility_type].append(storage_facility)
        return {
            "summary": {
                group_name: {
                    "display_name": engine.const_config["assets"][group_name]["name"],
                    "count": len(group),
                    "storage_capacity": sum(f.storage_capacity for f in group),
                    "state_of_charge": group[0].state_of_charge,
                    "hourly_op_cost": capacities[group_name]["O&M_cost"] * ticks_per_hour,
                    "efficiency": sum(f.efficiency * f.storage_capacity for f in group)
                    / sum(f.storage_capacity for f in group),
                    "remaining_lifespan": None
                    if all(f.decommissioning for f in group)
                    else min(f.remaining_lifespan for f in group if f.remaining_lifespan is not None),
                    "upgrade_cost": sum(f.upgrade_cost for f in group if f.is_upgradable and f.upgrade_cost is not None)
                    if any(f.is_upgradable for f in group)
                    else None,
                    "dismantle_cost": None
                    if all(f.decommissioning for f in group)
                    else sum(f.dismantle_cost for f in group if not f.decommissioning),
                }
                for group_name, group in storage_facility_groups.items()
            },
            "detail": {
                storage_facility.id: {
                    "facility": storage_facility.facility_type,
                    "display_name": storage_facility.display_name,
                    "storage_capacity": storage_facility.storage_capacity,
                    "state_of_charge": storage_facility.state_of_charge,
                    "hourly_op_cost": storage_facility.hourly_op_cost,
                    "efficiency": storage_facility.efficiency,
                    "remaining_lifespan": storage_facility.remaining_lifespan,
                    "upgrade_cost": None if storage_facility.decommissioning else storage_facility.upgrade_cost,
                    "dismantle_cost": None if storage_facility.decommissioning else storage_facility.dismantle_cost,
                }
                for storage_facility in active_storage_facilities
            },
        }

    def package_active_extraction_facilities(self) -> dict:
        """Package active extraction facilities."""
        ticks_per_hour = 3600 / engine.in_game_seconds_per_tick
        capacities = self.capacities
        active_extraction_facilities: list[ActiveFacility] = [
            active_facility
            for active_facility in ActiveFacility.filter_by(player=self)
            if isinstance(active_facility.facility_type, ExtractionFacilityType)
        ]
        extraction_facility_groups: dict[str, list[ActiveFacility]] = defaultdict(list)
        for extraction_facility in active_extraction_facilities:
            extraction_facility_groups[extraction_facility.facility_type].append(extraction_facility)
        return {
            "summary": {
                group_name: {
                    "display_name": engine.const_config["assets"][group_name]["name"],
                    "count": len(group),
                    "extraction_rate": sum(f.extraction_rate for f in group),
                    "usage": sum(f.usage * f.extraction_rate for f in group) / sum(f.extraction_rate for f in group),
                    "hourly_op_cost": capacities[group_name]["O&M_cost"] * ticks_per_hour,
                    "max_power_use": sum(f.max_power_use for f in group),
                    "remaining_lifespan": min(f.remaining_lifespan for f in group if f.remaining_lifespan is not None),
                    "upgrade_cost": sum(f.upgrade_cost for f in group if f.is_upgradable and f.upgrade_cost is not None)
                    if any(f.is_upgradable for f in group)
                    else None,
                    "dismantle_cost": sum(f.dismantle_cost for f in group),
                }
                for group_name, group in extraction_facility_groups.items()
            },
            "detail": {
                extraction_facility.id: {
                    "facility": extraction_facility.facility_type,
                    "display_name": extraction_facility.display_name,
                    "extraction_rate": extraction_facility.extraction_rate,
                    "usage": extraction_facility.usage,
                    "hourly_op_cost": extraction_facility.hourly_op_cost,
                    "max_power_use": extraction_facility.max_power_use,
                    "remaining_lifespan": extraction_facility.remaining_lifespan,
                    "upgrade_cost": extraction_facility.upgrade_cost,
                    "dismantle_cost": extraction_facility.dismantle_cost,
                }
                for extraction_facility in active_extraction_facilities
            },
        }

    def invalidate_recompute_and_dispatch_data_for_pages(
        self,
        *,
        power_facilities: bool = False,
        storage_facilities: bool = False,
        extraction_facilities: bool = False,
        functional_facilities: bool = False,
        technologies: bool = False,
    ) -> None:
        """Invalidate the facility data for the specified pages and dispatch the new data to the clients."""
        if power_facilities and "power_facilities_data" in self.__dict__:
            del self.power_facilities_data
        if storage_facilities and "storage_facilities_data" in self.__dict__:
            del self.storage_facilities_data
        if extraction_facilities and "extraction_facilities_data" in self.__dict__:
            del self.extraction_facilities_data
        if functional_facilities and "functional_facilities_data" in self.__dict__:
            del self.functional_facilities_data
        if technologies and "technologies_data" in self.__dict__:
            del self.technologies_data
        if self.socketio_clients:
            pages_data: dict = {}
            if power_facilities:
                pages_data |= {"power_facilities": self.power_facilities_data}
            if storage_facilities:
                pages_data |= {"storage_facilities": self.storage_facilities_data}
            if extraction_facilities:
                pages_data |= {"extraction_facilities": self.extraction_facilities_data}
            if functional_facilities:
                pages_data |= {"functional_facilities": self.functional_facilities_data}
            if technologies:
                pages_data |= {"technologies": self.technologies_data}
            self.emit("update_page_data", pages_data)
