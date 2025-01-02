"""Contains the classes that define the players and networks."""

from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass, field
from enum import StrEnum
from functools import cached_property
from itertools import chain
from typing import TYPE_CHECKING, Any

from flask import current_app
from flask_login import UserMixin
from pywebpush import WebPushException, webpush

from energetica.config.achievements import achievements
from energetica.config.assets import WorkerType
from energetica.database import DBModel
from energetica.database.engine_data import CapacityData, CircularBufferPlayer, CumulativeEmissionsData, PlayerPrices
from energetica.database.messages import Chat, Notification
from energetica.database.ongoing_project import OngoingProject, ProjectStatus
from energetica.database.shipment import OngoingShipment
from energetica.game_error import GameError
from energetica.globals import engine
from energetica.technology_effects import (
    package_available_technologies,
    package_extraction_facilities,
    package_functional_facilities,
    package_power_facilities,
    package_storage_facilities,
)

if TYPE_CHECKING:
    from collections.abc import Iterator

    from energetica.database.active_facility import ActiveFacility
    from energetica.database.climate_event_recovery import ClimateEventRecovery
    from energetica.database.map import HexTile
    from energetica.database.network import Network
    from energetica.database.resource_on_sale import ResourceOnSale


@dataclass
# TODO (Felix): add @dataclass(eq=False) on all classes
class Player(DBModel, UserMixin):
    """Class that stores the users and their data."""

    # Authentication :
    username: str
    pwhash: str

    # inactive: bool = False  # True if account is inactive
    show_disclaimer: bool = True
    last_opened_chat: int = 0

    tile: HexTile | None = None
    network: Network | None = None

    # TODO (Felix): Modify the post__init__ of DBModel to store the following objects in engine or in the player
    chats: list[Chat] = field(default_factory=list)  # Engine + Player reference
    notifications: list[Notification] = field(default_factory=list)  # Player
    resource_market_offers: list[ResourceOnSale] = field(default_factory=list)  # Player
    shipments: list[OngoingShipment] = field(default_factory=list)  # Player
    active_facilities: list[ActiveFacility] = field(default_factory=list)  # Player
    climate_events: list[ClimateEventRecovery] = field(default_factory=list)  # Player
    constructions_by_priority: list[OngoingProject] = field(default_factory=list)  # Player
    researches_by_priority: list[OngoingProject] = field(default_factory=list)  # Player
    # TODO(mglst): I suggest renaming the above to "research_projects(_by_priority)"

    network_prices: PlayerPrices = field(default_factory=PlayerPrices)
    rolling_history: CircularBufferPlayer = field(default_factory=CircularBufferPlayer)
    capacities: CapacityData = field(default_factory=CapacityData)
    cumul_emissions: CumulativeEmissionsData = field(default_factory=CumulativeEmissionsData)

    # TODO (Felix): This list can be transformed in a property
    list_of_renewables: list[str] = field(default_factory=list)
    priorities_of_controllables: list[str] = field(default_factory=lambda: ["steam_engine"])
    priorities_of_demand: list[str] = field(default_factory=lambda: ["industry", "construction"])

    achievements: list[str] = field(default_factory=list)

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
    notification_subscriptions: list[int] = field(default_factory=list)
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
    socketio_clients: list = field(default_factory=list)

    def get_level(self: Player, requirement_name: str) -> int:
        if requirement_name in self.functional_facility_lvl:
            return self.functional_facility_lvl[requirement_name]
        elif requirement_name in self.technology_lvl:
            return self.technology_lvl[requirement_name]
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
    resources: dict[str, float] = field(
        default_factory=lambda: {
            "coal": 0,
            "gas": 0,
            "uranium": 0,
        },
    )
    resources_on_sale: dict[str, float] = field(
        default_factory=lambda: {
            "coal": 0,
            "gas": 0,
            "uranium": 0,
        },
    )

    workers: dict[str, int] = field(
        default_factory=lambda: {
            "construction": 1,
            "laboratory": 0,
        },
    )

    functional_facility_lvl: dict[str, int] = field(
        default_factory=lambda: {
            "industry": 1,
            "laboratory": 0,
            "warehouse": 0,
            "carbon_capture": 0,
        },
    )

    technology_lvl: dict[str, int] = field(
        default_factory=lambda: {
            "mathematics": 0,
            "mechanical_engineering": 0,
            "thermodynamics": 0,
            "physics": 0,
            "building_technology": 0,
            "mineral_extraction": 0,
            "transport_technology": 0,
            "materials": 0,
            "civil_engineering": 0,
            "aerodynamics": 0,
            "chemistry": 0,
            "nuclear_engineering": 0,
        },
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

    def get_project_priority_list(self, worker_type: WorkerType) -> list[OngoingProject]:
        """Return the priority list for a given project type."""
        if worker_type == WorkerType.RESEARCH:
            return self.researches_by_priority
        if worker_type == WorkerType.CONSTRUCTION:
            return self.constructions_by_priority
        raise GameError("InvalidWorkerType")

    def set_project_priority_list(self, worker_type: WorkerType, priority_list: list[OngoingProject]) -> None:
        """Set the priority list for a given project type."""
        if worker_type == WorkerType.RESEARCH:
            self.researches_by_priority = priority_list
        elif worker_type == WorkerType.CONSTRUCTION:
            self.constructions_by_priority = priority_list
        else:
            raise GameError("InvalidWorkerType")

    def available_workers(self, worker_type: WorkerType) -> int:
        """Return the number of available workers depending on the project type."""
        if worker_type == WorkerType.RESEARCH:
            return self.available_lab_workers()
        if worker_type == WorkerType.CONSTRUCTION:
            return self.available_construction_workers()
        raise GameError("InvalidWorkerType")

    # TODO (Felix): Could that not be a property of a newly created Worker class ?
    def available_construction_workers(self) -> int:
        """Return the number of available construction workers."""
        occupied_workers = len(
            list(
                OngoingProject.filter(
                    lambda construction: construction.player == self
                    and construction.family != "Technologies"
                    and construction.status == ProjectStatus.ONGOING,
                ),
            ),
        )
        return self.workers["construction"] - occupied_workers

    # TODO (Felix): Could that not be a property of a newly created Worker class ?
    def available_lab_workers(self) -> int:
        """Return the number of available lab workers."""
        occupied_workers = len(
            list(
                OngoingProject.filter(
                    lambda construction: construction.player == self
                    and construction.family == "Technologies"
                    and construction.status == ProjectStatus.ONGOING,
                ),
            ),
        )
        return self.workers["laboratory"] - occupied_workers

    def package_chat_messages(self, chat: Chat) -> list[dict]:
        """Package the last 20 messages of a chat."""
        messages_list = [
            {
                "time": message.time.isoformat(),
                "player_id": message.player.id,
                "text": message.text,
            }
            for message in chat.messages[-20:]
        ]
        return messages_list

    def mark_chat_as_read(self, chat: Chat) -> None:
        """Mark a chat as read."""
        self.last_opened_chat = chat.id
        chat.last_read_message[self.id] = len(chat.messages) - 1

    def package_chat_list(self) -> dict:
        """Package the chats of a player."""

        def chat_name(chat: Chat) -> str:
            if chat.name is not None:
                return chat.name
            for participant in chat.participants:
                if participant != self:
                    return participant.username
            msg = "Chat has no name and no other participant"
            raise ValueError(msg)

        def find_initials(chat: Chat) -> list[str]:
            if chat.name is None:
                for participant in chat.participants:
                    if participant != self:
                        return [participant.username[0]]
            max_initials_size = 4
            initials = []
            for participant in chat.participants:
                initials.append(participant.username[0])
                if len(initials) == max_initials_size:
                    break
            return initials

        def unread_message_count(chat: Chat) -> int:
            # TODO(mglst): what if last_read_message is None?
            return len(chat.messages) - chat.last_read_message[self.id] - 1

        chat_dict = {
            chat.id: {
                "name": chat_name(chat),
                "initials": find_initials(chat),
                "group_chat": chat.name is not None,
                "unread_messages": unread_message_count(chat),
            }
            for chat in self.chats
        }
        return {
            "chat_list": chat_dict,
            "last_opened_chat": self.last_opened_chat,
        }

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
            for chat in self.chats
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

    def get_lvls(self) -> dict:
        """Return the levels of functional facilities and technologies of a player."""
        return self.technology_lvl | self.functional_facility_lvl

    def get_reserves(self) -> dict:
        """Return natural resources reserves of a player."""
        reserves = {}
        for resource in ["coal", "gas", "uranium"]:
            reserves[resource] = getattr(self.tile, resource)
        return reserves

    def emit(self, event: str, *args) -> None:
        """Emit a socketio event to the player's clients."""
        for sid in self.socketio_clients:
            engine.socketio.emit(event, *args, room=sid)

    def send_new_data(self, new_values) -> None:
        """Send the new data to the player's clients."""
        construction_updates = self.get_construction_updates()
        shipment_updates = self.get_shipment_updates()
        self.emit(
            "new_values",
            {
                "total_t": engine.data["total_t"],
                "chart_values": new_values,
                "climate_values": engine.data["current_climate_data"].get_last_data(),
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
        """Create a new notification and sends it to the player's subscribed browsers."""
        new_notification = Notification(title=title, content=message, player=self)
        self.notifications.append(new_notification)
        self.emit(
            "new_notification",
            {
                "id": new_notification.id,
                "time": str(new_notification.time),
                "title": new_notification.title,
                "content": new_notification.content,
            },
        )
        if (
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
            current_app.config["VAPID_CLAIMS"]["aud"] = audience
            try:
                webpush(
                    subscription_info=subscription,
                    data=json.dumps(notification_data),
                    vapid_private_key=current_app.config["VAPID_PRIVATE_KEY"],
                    vapid_claims=current_app.config["VAPID_CLAIMS"],
                )
            except WebPushException as ex:
                engine.warn(f"Failed to send notification: {repr(ex)}")

    def send_worker_info(self) -> None:
        """Send the number of available construction and lab workers to the player's clients."""
        self.emit(
            "worker_info",
            {
                "construction": {
                    "available": self.available_construction_workers(),
                    "total": self.workers["construction"],
                },
                "laboratory": {
                    "available": self.available_lab_workers(),
                    "total": self.workers["laboratory"],
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
        return "Discover the Greenhouse Effect" in self.achievements

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
            for i, value in enumerate(achievements[achievement]["milestones"]):
                achievement_name = achievements[achievement]["name"]
                if f"{achievement_name} {i+1}" not in self.achievements:
                    if self.progression_metrics[achievements[achievement]["metric"]] >= value:
                        self.achievements.append(f"{achievement_name} {i+1}")
                        self.progression_metrics["xp"] += achievements[achievement]["rewards"][i]
                        message = achievements[achievement]["message"]
                        if achievement == "network":
                            message = message.format(reward=achievements[achievement]["rewards"][i])
                        elif "comparisons" in achievements[achievement]:
                            message = message.format(
                                value=value,
                                reward=achievements[achievement]["rewards"][i],
                                comparison=achievements[achievement]["comparisons"][i],
                            )
                        else:
                            message = message.format(value=value, reward=achievements[achievement]["rewards"][i])
                        self.notify("Achievement", message)
                    break

    def check_construction_achievements(self, construction_name: str) -> None:
        """Check for player achievements that may be unlocked by a construction."""
        for achievement in ["laboratory", "warehouse", "GHG_effect", "storage_facilities"]:
            achievement_name = achievements[achievement]["name"]
            if (
                achievement_name not in self.achievements
                and construction_name in achievements[achievement]["unlocked_with"]
            ):
                self.achievements.append(achievement_name)
                self.progression_metrics["xp"] += achievements[achievement]["reward"]
                message = achievements[achievement]["message"].format(reward=achievements[achievement]["reward"])
                self.notify("Achievement", message)

    def check_technology_achievement(self) -> None:
        """Check for technology achievement."""
        achievement_name = achievements["technology"]["name"]
        for i, value in enumerate(achievements["technology"]["milestones"]):
            if (
                f"{achievement_name} {i+1}" not in self.achievements
                and self.progression_metrics[achievements["technology"]["metric"]] >= value
            ):
                self.achievements.append(f"{achievement_name} {i+1}")
                self.progression_metrics["xp"] += achievements["technology"]["rewards"][i]
                message = achievements["technology"]["message"].format(
                    value=value,
                    reward=achievements["technology"]["rewards"][i],
                )
                self.notify("Achievement", message)

    def check_trading_achievement(self) -> None:
        """Check for trading achievement."""
        achievement_name = achievements["trading"]["name"]
        for i, value in enumerate(achievements["trading"]["milestones"]):
            if f"{achievement_name} {i+1}" not in self.achievements and (
                self.progression_metrics[achievements["trading"]["metric"][0]]
                + self.progression_metrics[achievements["trading"]["metric"][1]]
                >= value
            ):
                self.achievements.append(f"{achievement_name} {i+1}")
                self.progression_metrics["xp"] += achievements["trading"]["rewards"][i]
                message = achievements["trading"]["message"].format(
                    value=value,
                    reward=achievements["trading"]["rewards"][i],
                )
                self.notify("Achievement", message)

    def package_upcoming_achievements(self) -> dict:
        """Package the progress information for the upcoming achievements."""
        upcoming_achievements = {}
        for achievement, achievement_data in achievements.items():
            requirements_met = all(requirement in self.achievements for requirement in achievement_data["requirements"])
            if not requirements_met:
                continue
            if achievement in ["laboratory", "warehouse", "GHG_effect", "storage_facilities"]:
                if achievement_data["name"] not in self.achievements:
                    upcoming_achievements[achievement] = {
                        "name": achievement_data["name"],
                        "reward": achievement_data["reward"],
                        "objective": 1,
                        "status": 0,
                    }
            else:
                for i, value in enumerate(achievement_data["milestones"]):
                    if f"{achievement_data['name']} {i+1}" not in self.achievements:
                        if achievement == "trading":
                            status = (
                                self.progression_metrics[achievement_data["metric"][0]]
                                + self.progression_metrics[achievement_data["metric"][1]]
                            )
                        else:
                            status = self.progression_metrics[achievement_data["metric"]]
                        upcoming_achievements[achievement] = {
                            "name": f"{achievement_data['name']} {i+1}",
                            "reward": achievement_data["rewards"][i],
                            "objective": value,
                            "status": round(status),
                        }
                        break
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

    @staticmethod
    def package_all() -> dict[int, dict]:
        """Package data for all players."""
        return {player.id: player.package() for player in Player.all()}

    def package_scoreboard(self) -> dict[int, dict]:
        """Package the scoreboard data for players with a tile."""
        players = Player.filter(lambda p: p.tile is not None)
        include_co2_emissions = self.discovered_greenhouse_gas_effect()
        return {
            player.id: (
                {
                    "username": player.username,
                    "network_name": player.network.name if player.network else "-",
                    "average_hourly_revenues": player.progression_metrics["average_revenues"],
                    "max_power_consumption": player.progression_metrics["max_power_consumption"],
                    "total_technology_levels": player.progression_metrics["total_technologies"],
                    "xp": player.progression_metrics["xp"],
                }
                | ({"co2_emissions": player.calculate_net_emissions()} if include_co2_emissions else {})
            )
            for player in players
        }

    def package_constructions(self) -> dict[int, dict]:
        """Package the player's ongoing constructions."""
        return {
            construction.id: {
                k: getattr(construction, k)
                for k in [
                    "id",
                    "name",
                    "family",
                    "end_tick_or_ticks_passed",
                    "duration",
                    "status",
                ]
            }
            | {"display_name": engine.const_config["assets"][construction.name]["name"]}
            | ({"level": construction.level} if construction.level is not None else {})
            | {"speed": construction.speed}
            for construction in (*self.constructions_by_priority, *self.researches_by_priority)
        }

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
            for shipment in self.shipments
        }

    def package_construction_queue(self) -> list:
        """Package the player's construction queue (list of construction_ids)."""
        return self.constructions_by_priority

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
        power_facilities: list[ActiveFacility] = list(
            filter(lambda facility: facility.name in engine.power_facilities, self.active_facilities)
        )
        power_facility_groups: dict[str, list[ActiveFacility]] = defaultdict(list)
        for power_facility in power_facilities:
            power_facility_groups[power_facility.name].append(power_facility)
        return {
            "summary": {
                group_name: {
                    "display_name": engine.const_config["assets"][group_name]["name"],
                    "count": len(group),
                    "installed_cap": self.capacities[group_name]["power"],
                    "usage": sum(f.usage * f.max_power_generation for f in group)
                    / sum(f.max_power_generation for f in group),
                    "hourly_op_cost": self.capacities[group_name]["O&M_cost"] * ticks_per_hour,
                    "remaining_lifespan": min(f.remaining_lifespan for f in group),
                    "upgrade_cost": sum(f.upgrade_cost for f in group if f.is_upgradable)
                    if any(f.is_upgradable for f in group)
                    else None,
                    "dismantle_cost": sum(f.dismantle_cost for f in group),
                }
                | (
                    {"cut_out_speed_exceeded": any(f.cut_out_speed_exceeded for f in group)}
                    if group_name in ["windmill", "onshore_wind_turbine", "offshore_wind_turbine"]
                    else {}
                )
                for group_name, group in power_facility_groups.items()
            },
            "detail": {
                power_facility.id: {
                    "facility": power_facility.name,
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
                    if power_facility.name in ["windmill", "onshore_wind_turbine", "offshore_wind_turbine"]
                    else {}
                )
                for power_facility in power_facilities
            },
        }

    def package_active_storage_facilities(self) -> dict:
        """Package active storage facilities."""
        ticks_per_hour = 3600 / engine.in_game_seconds_per_tick
        capacities = self.capacities
        storage_facilities: list[ActiveFacility] = [
            facility for facility in self.active_facilities if facility.name in engine.storage_facilities
        ]
        storage_facility_groups: dict[str, list[ActiveFacility]] = defaultdict(list)
        for storage_facility in storage_facilities:
            storage_facility_groups[storage_facility.name].append(storage_facility)
        return {
            "summary": {
                group_name: {
                    "display_name": engine.const_config["assets"][group_name]["name"],
                    "count": len(group),
                    "storage_capacity": sum(f.storage_capacity for f in group),
                    "state_of_charge": sum(f.state_of_charge * f.storage_capacity for f in group)
                    / sum(f.storage_capacity for f in group),
                    "hourly_op_cost": capacities[group_name]["O&M_cost"] * ticks_per_hour,
                    "efficiency": sum(f.efficiency * f.storage_capacity for f in group)
                    / sum(f.storage_capacity for f in group),
                    "remaining_lifespan": None
                    if all(f.decommissioning for f in group)
                    else min(f.remaining_lifespan for f in group if not f.decommissioning),
                    "upgrade_cost": sum(f.upgrade_cost for f in group if f.is_upgradable)
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
                    "facility": storage_facility.name,
                    "display_name": storage_facility.display_name,
                    "storage_capacity": storage_facility.storage_capacity,
                    "state_of_charge": storage_facility.state_of_charge,
                    "hourly_op_cost": storage_facility.hourly_op_cost,
                    "efficiency": storage_facility.efficiency,
                    "remaining_lifespan": storage_facility.remaining_lifespan,
                    "upgrade_cost": None if storage_facility.decommissioning else storage_facility.upgrade_cost,
                    "dismantle_cost": None if storage_facility.decommissioning else storage_facility.dismantle_cost,
                }
                for storage_facility in storage_facilities
            },
        }

    def package_active_extraction_facilities(self) -> dict:
        """Package active extraction facilities."""
        ticks_per_hour = 3600 / engine.in_game_seconds_per_tick
        capacities = self.capacities
        extraction_facilities: list[ActiveFacility] = [
            facility for facility in self.active_facilities if facility.name in engine.extraction_facilities
        ]
        extraction_facility_groups: dict[str, list[ActiveFacility]] = defaultdict(list)
        for extraction_facility in extraction_facilities:
            extraction_facility_groups[extraction_facility.name].append(extraction_facility)
        return {
            "summary": {
                group_name: {
                    "display_name": engine.const_config["assets"][group_name]["name"],
                    "count": len(group),
                    "extraction_rate": sum(f.extraction_rate for f in group),
                    "usage": sum(f.usage * f.extraction_rate for f in group) / sum(f.extraction_rate for f in group),
                    "hourly_op_cost": capacities[group_name]["O&M_cost"] * ticks_per_hour,
                    "max_power_use": sum(f.max_power_use for f in group),
                    "remaining_lifespan": min(f.remaining_lifespan for f in group),
                    "upgrade_cost": sum(f.upgrade_cost for f in group if f.is_upgradable)
                    if any(f.is_upgradable for f in group)
                    else None,
                    "dismantle_cost": sum(f.dismantle_cost for f in group),
                }
                for group_name, group in extraction_facility_groups.items()
            },
            "detail": {
                extraction_facility.id: {
                    "facility": extraction_facility.name,
                    "display_name": extraction_facility.display_name,
                    "extraction_rate": extraction_facility.extraction_rate,
                    "usage": extraction_facility.usage,
                    "hourly_op_cost": extraction_facility.hourly_op_cost,
                    "max_power_use": extraction_facility.max_power_use,
                    "remaining_lifespan": extraction_facility.remaining_lifespan,
                    "upgrade_cost": extraction_facility.upgrade_cost,
                    "dismantle_cost": extraction_facility.dismantle_cost,
                }
                for extraction_facility in extraction_facilities
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
            # TODO(mglst): update clients over websocket
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
