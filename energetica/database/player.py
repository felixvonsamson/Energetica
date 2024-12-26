"""Contains the classes that define the players and networks."""

from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from functools import cached_property
from itertools import chain
from typing import TYPE_CHECKING

from flask import current_app
from flask_login import UserMixin
from pywebpush import WebPushException, webpush

from energetica.config.achievements import achievements
from energetica.database import db
from energetica.database.active_facility import ActiveFacility
from energetica.database.engine_data import CapacityData, CircularBufferPlayer, CumulativeEmissionsData, PlayerPrices
from energetica.database.messages import Chat, Message, Notification, player_chats
from energetica.database.ongoing_construction import ConstructionStatus, OngoingConstruction
from energetica.database.shipment import Shipment
from energetica.technology_effects import (
    package_available_technologies,
    package_extraction_facilities,
    package_functional_facilities,
    package_power_facilities,
    package_storage_facilities,
)

if TYPE_CHECKING:
    from energetica.game_engine import GameEngine


@dataclass
class PlayerData:
    """Dataclass that stores the player data."""

    network_prices: PlayerPrices = field(default_factory=PlayerPrices)
    list_of_renewables: list[str] = field(default_factory=list)
    priorities_of_controllables: list[str] = field(default_factory=lambda: ["steam_engine"])
    priorities_of_demand: list[str] = field(default_factory=lambda: ["industry", "construction"])

    # NOTE (Felix): do we want to still have list of ids for player constructions and research or do we want to
    # directly store the objects here?
    construction_priorities: list[int] = field(default_factory=list)
    research_priorities: list[int] = field(default_factory=list)

    achievements: list[str] = field(default_factory=list)

    rolling_history: CircularBufferPlayer = field(default_factory=CircularBufferPlayer)
    capacities: CapacityData = field(default_factory=CapacityData)
    cumul_emissions: CumulativeEmissionsData = field(default_factory=CumulativeEmissionsData)

    # Browser notifications & preferences
    notification_subscriptions: list[int] = field(default_factory=list)
    notification_preferences: dict = field(
        default_factory=lambda: {
            "messages": True,
            "achievements": True,
            "projects": True,
            "decommissioning": True,
            "resource_market": True,
            "climate_events": True,
        }
    )


@dataclass
class PlayerCache:
    """Dataclass that stores cached player data."""

    player_id: int

    @cached_property
    def power_facilities_data(self) -> list:
        """Cached property that stores the power facilities data of a player."""
        player = db.session.get(Player, self.player_id)
        return package_power_facilities(player)

    @cached_property
    def storage_facilities_data(self) -> list:
        """Cached property that stores the storage facilities data of a player."""
        player = db.session.get(Player, self.player_id)
        return package_storage_facilities(player)

    @cached_property
    def extraction_facilities_data(self) -> list:
        """Cached property that stores the extraction facilities data of a player."""
        player = db.session.get(Player, self.player_id)
        return package_extraction_facilities(player)

    @cached_property
    def functional_facilities_data(self) -> list:
        """Cached property that stores the functional facilities data of a player."""
        player = db.session.get(Player, self.player_id)
        return package_functional_facilities(player)

    @cached_property
    def technologies_data(self) -> list:
        """Cached property that stores the technologies data of a player."""
        player = db.session.get(Player, self.player_id)
        return package_available_technologies(player)


class Player(db.Model, UserMixin):
    """Class that stores the users."""

    id = db.Column(db.Integer, primary_key=True)

    # Authentication :
    username = db.Column(db.String(25), unique=True)
    pwhash = db.Column(db.String(50))

    # Position :
    tile = db.relationship("Hex", uselist=False, backref="player")

    # Chats :
    show_disclaimer = db.Column(db.Boolean, default=True)
    chats = db.relationship("Chat", secondary=player_chats, backref="participants")
    last_opened_chat = db.Column(db.Integer, default=1)
    messages = db.relationship("Message", backref="player")

    notifications = db.relationship("Notification", backref="players", lazy="dynamic")

    # misc :
    graph_view = db.Column(db.String(10), default="basic")
    network_id = db.Column(db.Integer, db.ForeignKey("network.id"), default=None)

    class NetworkGraphView(StrEnum):
        """Enum for the network graph view of the player."""

        BASIC = "basic"
        NORMAL = "normal"
        EXPERT = "expert"

    # resources :
    money = db.Column(db.Float, default=25000)  # default is 25000
    coal = db.Column(db.Float, default=0)
    gas = db.Column(db.Float, default=0)
    uranium = db.Column(db.Float, default=0)
    coal_on_sale = db.Column(db.Float, default=0)
    gas_on_sale = db.Column(db.Float, default=0)
    uranium_on_sale = db.Column(db.Float, default=0)

    # Workers :
    construction_workers = db.Column(db.Integer, default=1)
    lab_workers = db.Column(db.Integer, default=0)

    # Functional Facilities :
    industry = db.Column(db.Integer, default=1)
    laboratory = db.Column(db.Integer, default=0)
    warehouse = db.Column(db.Integer, default=0)
    carbon_capture = db.Column(db.Integer, default=0)

    # Technology :
    mathematics = db.Column(db.Integer, default=0)
    mechanical_engineering = db.Column(db.Integer, default=0)
    thermodynamics = db.Column(db.Integer, default=0)
    physics = db.Column(db.Integer, default=0)
    building_technology = db.Column(db.Integer, default=0)
    mineral_extraction = db.Column(db.Integer, default=0)
    transport_technology = db.Column(db.Integer, default=0)
    materials = db.Column(db.Integer, default=0)
    civil_engineering = db.Column(db.Integer, default=0)
    aerodynamics = db.Column(db.Integer, default=0)
    chemistry = db.Column(db.Integer, default=0)
    nuclear_engineering = db.Column(db.Integer, default=0)

    # Priority lists
    construction_priorities = db.Column(db.Text, default="")
    research_priorities = db.Column(db.Text, default="")

    # Production capacity prices [¤/MWh]
    price_steam_engine = db.Column(db.Float, default=125)
    price_coal_burner = db.Column(db.Float, default=600)
    price_gas_burner = db.Column(db.Float, default=500)
    price_combined_cycle = db.Column(db.Float, default=450)
    price_nuclear_reactor = db.Column(db.Float, default=275)
    price_nuclear_reactor_gen4 = db.Column(db.Float, default=375)

    # Storage capacity prices [¤/MWh]
    price_buy_small_pumped_hydro = db.Column(db.Float, default=210)
    price_small_pumped_hydro = db.Column(db.Float, default=790)
    price_buy_molten_salt = db.Column(db.Float, default=190)
    price_molten_salt = db.Column(db.Float, default=830)
    price_buy_large_pumped_hydro = db.Column(db.Float, default=200)
    price_large_pumped_hydro = db.Column(db.Float, default=780)
    price_buy_hydrogen_storage = db.Column(db.Float, default=230)
    price_hydrogen_storage = db.Column(db.Float, default=880)
    price_buy_lithium_ion_batteries = db.Column(db.Float, default=425)
    price_lithium_ion_batteries = db.Column(db.Float, default=940)
    price_buy_solid_state_batteries = db.Column(db.Float, default=420)
    price_solid_state_batteries = db.Column(db.Float, default=900)

    # Demand buying prices
    price_buy_industry = db.Column(db.Float, default=1000)
    price_buy_construction = db.Column(db.Float, default=1020)
    price_buy_research = db.Column(db.Float, default=1200)
    price_buy_transport = db.Column(db.Float, default=1050)
    price_buy_coal_mine = db.Column(db.Float, default=960)
    price_buy_gas_drilling_site = db.Column(db.Float, default=980)
    price_buy_uranium_mine = db.Column(db.Float, default=990)
    price_buy_carbon_capture = db.Column(db.Float, default=660)

    # player progression data :
    xp = db.Column(db.Integer, default=0)
    average_revenues = db.Column(db.Float, default=0)
    max_power_consumption = db.Column(db.Float, default=0)
    max_energy_stored = db.Column(db.Float, default=0)
    extracted_resources = db.Column(db.Float, default=0)
    bought_resources = db.Column(db.Float, default=0)
    sold_resources = db.Column(db.Float, default=0)
    total_technologies = db.Column(db.Integer, default=0)
    imported_energy = db.Column(db.Float, default=0)
    exported_energy = db.Column(db.Float, default=0)
    captured_co2 = db.Column(db.Float, default=0)

    under_construction = db.relationship("OngoingConstruction")
    resource_on_sale = db.relationship("ResourceOnSale", backref="player")
    shipments = db.relationship("Shipment", backref="player")
    active_facilities = db.relationship("ActiveFacility", backref="player", lazy="dynamic")
    climate_events = db.relationship("ClimateEventRecovery", backref="player")

    @property
    def engine(self) -> GameEngine:
        """Return the game engine."""
        return current_app.config["engine"]

    @property
    def config(self) -> dict:
        """Return the player's configuration."""
        return current_app.config["engine"].config[self]

    @property
    def socketio_clients(self) -> list[int]:
        """Return the player's socketio clients."""
        return current_app.config["engine"].clients[self.id]

    @cached_property
    def data(self) -> PlayerData:
        """Returns the data for the player."""
        return current_app.config["engine"].data["by_player"][self.id]

    @cached_property
    def cache(self) -> PlayerCache:
        """Cached property that stores the player cache."""
        if self.id not in current_app.config["engine"].buffered["by_player"]:
            current_app.config["engine"].buffered["by_player"][self.id] = PlayerCache(self.id)
        return current_app.config["engine"].buffered["by_player"][self.id]

    @property
    def is_in_network(self) -> bool:
        """Return True if the player is in a network."""
        return self.network_id is not None

    def change_graph_view(self, view: NetworkGraphView) -> None:
        """Set the network graph view of the player (basic/normal/expert)."""
        self.graph_view = view
        db.session.commit()

    def available_workers(self, project_name):
        """Returns the number of available workers depending on the project type"""
        engine: GameEngine = current_app.config["engine"]
        if project_name in engine.technologies:
            return self.available_lab_workers()
        else:
            return self.available_construction_workers()

    def available_construction_workers(self) -> int:
        """Return the number of available construction workers."""
        occupied_workers = (
            OngoingConstruction.query.filter(OngoingConstruction.player_id == self.id)
            .filter(OngoingConstruction.family != "Technologies")
            .filter(OngoingConstruction.status == ConstructionStatus.ONGOING)
            .count()
        )
        return self.construction_workers - occupied_workers

    def available_lab_workers(self) -> int:
        """Return the number of available lab workers."""
        occupied_workers = (
            OngoingConstruction.query.filter(OngoingConstruction.player_id == self.id)
            .filter(OngoingConstruction.family == "Technologies")
            .filter(OngoingConstruction.status == ConstructionStatus.ONGOING)
            .count()
        )
        return self.lab_workers - occupied_workers

    def package_chat_messages(self, chat_id: int) -> list[dict]:
        """Package the last 20 messages of a chat."""
        chat = Chat.query.filter_by(id=chat_id).first()
        messages = chat.messages.order_by(Message.time.desc()).limit(20).all()
        messages_list = [
            {
                "time": message.time.isoformat(),
                "player_id": message.player_id,
                "text": message.text,
            }
            for message in reversed(messages)
        ]
        self.last_opened_chat = chat.id
        PlayerUnreadMessages.query.filter(PlayerUnreadMessages.player_id == self.id).filter(
            PlayerUnreadMessages.message_id.in_(db.session.query(Message.id).filter(Message.chat_id == chat_id))
        ).delete(synchronize_session=False)
        db.session.commit()
        return messages_list

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

        def find_initials(chat: Chat) -> str:
            if chat.name is None:
                for participant in chat.participants:
                    if participant != self:
                        return participant.username[0]
            max_initials_size = 4
            initials = []
            for participant in chat.participants:
                initials.append(participant.username[0])
                if len(initials) == max_initials_size:
                    break
            return initials

        def unread_message_count(chat: Chat) -> int:
            return (
                PlayerUnreadMessages.query.join(Message, PlayerUnreadMessages.message_id == Message.id)
                .filter(PlayerUnreadMessages.player_id == self.id)
                .filter(Message.chat_id == chat.id)
                .count()
            )

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
                "participants": list(map(lambda player: player.id, chat.participants)),
                "older_messages_exist": chat.messages.count() > 20,
                "messages": [
                    message.package()
                    for message in reversed(chat.messages.order_by(Message.time.desc()).limit(20).all())
                ],
            }
            for chat in self.chats
        }

    def delete_notification(self, notification_id: int) -> None:
        """Delete a notification."""
        notification = db.session.get(Notification, notification_id)
        if notification in self.notifications.all():
            db.session.delete(notification)
            db.session.commit()

    def notifications_read(self) -> None:
        """Mark all notifications as read."""
        for notification in self.unread_notifications():
            notification.read = True
        db.session.commit()

    def unread_notifications(self) -> list[Notification]:
        """Return all unread notifications."""
        return self.notifications.filter_by(read=False).all()

    def get_lvls(self) -> dict:
        """Return the levels of functional facilities and technologies of a player."""
        engine = current_app.config["engine"]
        attributes = chain(engine.functional_facilities, engine.technologies)
        return {attr: getattr(self, attr) for attr in attributes}

    def get_reserves(self) -> dict:
        """Return natural resources reserves of a player."""
        reserves = {}
        for resource in ["coal", "gas", "uranium"]:
            reserves[resource] = getattr(self.tile, resource)
        return reserves

    def emit(self, event: str, *args) -> None:
        """Emit a socketio event to the player's clients."""
        engine: GameEngine = current_app.config["engine"]
        for sid in self.socketio_clients:
            engine.socketio.emit(event, *args, room=sid)

    def send_new_data(self, new_values) -> None:
        """Send the new data to the player's clients."""
        engine = current_app.config["engine"]
        construction_updates = self.get_construction_updates()
        shipment_updates = self.get_shipment_updates()
        self.emit(
            "new_values",
            {
                "total_t": engine.data["total_t"],
                "chart_values": new_values,
                "climate_values": engine.data["current_climate_data"].get_last_data(),
                "cumulative_emissions": self.data.cumul_emissions.get_all(),
                "money": self.money,
                "construction_updates": construction_updates,
                "shipment_updates": shipment_updates,
            },
        )

    def get_construction_updates(self):
        """
        This method returns a dictionary of the constructions for which the progress speed has changed. For each of
        these constructions, the dictionary contains the new speed and the new end_tick.
        """
        player_constructions: list[OngoingConstruction] = OngoingConstruction.query.filter_by(
            player_id=self.id, status=ConstructionStatus.ONGOING
        ).all()
        construction_speeds = {}
        for construction in player_constructions:
            new_speed = construction.updated_speed()
            if new_speed is not None:
                construction_speeds[construction.id] = {
                    "speed": new_speed,
                    "end_tick": construction.end_tick_or_ticks_passed,
                }
        return construction_speeds

    def get_shipment_updates(self):
        """
        This method returns a dictionary of the shipments for which the progress speed has changed. For each of
        these shipments, the dictionary contains the new speed and the new arrival_tick.
        """
        player_shipments: list[Shipment] = Shipment.query.filter_by(player_id=self.id).all()
        shipment_speeds = {}
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
        new_notification = Notification(title=title, content=message, time=datetime.now(), player_id=self.id)
        db.session.add(new_notification)
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
            self.notifications.count() > 1
            and new_notification.content == self.notifications[self.notifications.count() - 2].content
            and new_notification.time == self.notifications[self.notifications.count() - 2].time
        ):
            return
        notification_data = {
            "title": new_notification.title,
            "body": new_notification.content,
        }
        engine: GameEngine = current_app.config["engine"]
        for subscription in self.data.notification_subscriptions:
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
                "construction_workers": {
                    "available": self.available_construction_workers(),
                    "total": self.construction_workers,
                },
                "lab_workers": {
                    "available": self.available_lab_workers(),
                    "total": self.lab_workers,
                },
            },
        )

    def calculate_net_emissions(self) -> float:
        """Calculate the net emissions of the player."""
        cumulative_emissions = self.data.cumul_emissions.get_all()
        net_emissions = 0
        for value in cumulative_emissions.values():
            net_emissions += value
        return net_emissions

    def discovered_greenhouse_gas_effect(self) -> bool:
        """Return True if the player has discovered the greenhouse gas effect."""
        return "Discover the Greenhouse Effect" in self.data.achievements

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
                if f"{achievement_name} {i+1}" not in self.data.achievements:
                    if getattr(self, achievements[achievement]["metric"]) >= value:
                        self.data.achievements.append(f"{achievement_name} {i+1}")
                        self.xp += achievements[achievement]["rewards"][i]
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
                achievement_name not in self.data.achievements
                and construction_name in achievements[achievement]["unlocked_with"]
            ):
                self.data.achievements.append(achievement_name)
                self.xp += achievements[achievement]["reward"]
                message = achievements[achievement]["message"].format(reward=achievements[achievement]["reward"])
                self.notify("Achievement", message)

    def check_technology_achievement(self) -> None:
        """Check for technology achievement."""
        achievement_name = achievements["technology"]["name"]
        for i, value in enumerate(achievements["technology"]["milestones"]):
            if (
                f"{achievement_name} {i+1}" not in self.data.achievements
                and getattr(self, achievements["technology"]["metric"]) >= value
            ):
                self.data.achievements.append(f"{achievement_name} {i+1}")
                self.xp += achievements["technology"]["rewards"][i]
                message = achievements["technology"]["message"].format(
                    value=value,
                    reward=achievements["technology"]["rewards"][i],
                )
                self.notify("Achievement", message)

    def check_trading_achievement(self) -> None:
        """Check for trading achievement."""
        achievement_name = achievements["trading"]["name"]
        for i, value in enumerate(achievements["trading"]["milestones"]):
            if f"{achievement_name} {i+1}" not in self.data.achievements and (
                getattr(self, achievements["trading"]["metric"][0])
                + getattr(self, achievements["trading"]["metric"][1])
                >= value
            ):
                self.data.achievements.append(f"{achievement_name} {i+1}")
                self.xp += achievements["trading"]["rewards"][i]
                message = achievements["trading"]["message"].format(
                    value=value,
                    reward=achievements["trading"]["rewards"][i],
                )
                self.notify("Achievement", message)

    def package_upcoming_achievements(self) -> dict:
        """Package the progress information for the upcoming achievements."""
        upcoming_achievements = {}
        for achievement, achievement_data in achievements.items():
            requirements_met = all(
                requirement in self.data.achievements for requirement in achievement_data["requirements"]
            )
            if not requirements_met:
                continue
            if achievement in ["laboratory", "warehouse", "GHG_effect", "storage_facilities"]:
                if achievement_data["name"] not in self.data.achievements:
                    upcoming_achievements[achievement] = {
                        "name": achievement_data["name"],
                        "reward": achievement_data["reward"],
                        "objective": 1,
                        "status": 0,
                    }
            else:
                for i, value in enumerate(achievement_data["milestones"]):
                    if f"{achievement_data['name']} {i+1}" not in self.data.achievements:
                        if achievement == "trading":
                            status = getattr(self, achievement_data["metric"][0]) + getattr(
                                self,
                                achievement_data["metric"][1],
                            )
                        else:
                            status = getattr(self, achievement_data["metric"])
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
            | ({"network_id": self.network_id} if self.network_id is not None else {})
            | ({"cell_id": self.tile.id} if self.tile is not None else {})
        )

    @staticmethod
    def package_all() -> dict[int, dict]:
        """Package data for all players."""
        players: list[Player] = Player.query.all()
        return {player.id: player.package() for player in players}

    def package_scoreboard(self) -> dict[int, dict]:
        """Package the scoreboard data for players with a tile."""
        players = Player.query.filter(Player.tile != None)
        include_co2_emissions = self.discovered_greenhouse_gas_effect()
        return {
            player.id: (
                {
                    "username": player.username,
                    "network_name": player.network.name if player.network else "-",
                    "average_hourly_revenues": player.average_revenues,
                    "max_power_consumption": player.max_power_consumption,
                    "total_technology_levels": player.total_technologies,
                    "xp": player.xp,
                }
                | ({"co2_emissions": player.calculate_net_emissions()} if include_co2_emissions else {})
            )
            for player in players
        }

    def package_constructions(self) -> dict[int, dict]:
        """Package the player's ongoing constructions."""
        constructions: list[OngoingConstruction] = self.under_construction
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
            | {"display_name": current_app.config["engine"].const_config["assets"][construction.name]["name"]}
            | ({"level": construction.cache.level} if construction.cache.level is not None else {})
            | {"speed": construction.data.speed}
            for construction in constructions
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
        return self.data.construction_priorities

    def package_active_facilities(self) -> dict[str, dict[int, dict[str, any]]]:
        """Package the player's active facilities."""
        return {
            "power_facilities": self.package_active_power_facilities(),
            "storage_facilities": self.package_active_storage_facilities(),
            "extraction_facilities": self.package_active_extraction_facilities(),
        }

    def package_active_power_facilities(self) -> dict:
        """Package the player's active power facilities."""
        engine: GameEngine = current_app.config["engine"]
        ticks_per_hour = 3600 / engine.in_game_seconds_per_tick
        capacities = self.data.capacities
        power_facilities: list[ActiveFacility] = self.active_facilities.filter(
            ActiveFacility.facility.in_(engine.power_facilities),
        ).all()
        power_facility_groups: dict[str, list[ActiveFacility]] = defaultdict(list)
        for power_facility in power_facilities:
            power_facility_groups[power_facility.facility].append(power_facility)
        return {
            "summary": {
                group_name: {
                    "display_name": engine.const_config["assets"][group_name]["name"],
                    "count": len(group),
                    "installed_cap": capacities[group_name]["power"],
                    "usage": sum(f.usage * f.max_power_generation for f in group)
                    / sum(f.max_power_generation for f in group),
                    "hourly_op_cost": capacities[group_name]["O&M_cost"] * ticks_per_hour,
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
                    "facility": power_facility.facility,
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
                    if power_facility.facility in ["windmill", "onshore_wind_turbine", "offshore_wind_turbine"]
                    else {}
                )
                for power_facility in power_facilities
            },
        }

    def package_active_storage_facilities(self) -> dict:
        """Package active storage facilities."""
        engine: GameEngine = current_app.config["engine"]
        ticks_per_hour = 3600 / engine.in_game_seconds_per_tick
        capacities = self.data.capacities
        storage_facilities: list[ActiveFacility] = self.active_facilities.filter(
            ActiveFacility.facility.in_(engine.storage_facilities),
        ).all()
        storage_facility_groups: dict[str, list[ActiveFacility]] = defaultdict(list)
        for storage_facility in storage_facilities:
            storage_facility_groups[storage_facility.facility].append(storage_facility)
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
                    "facility": storage_facility.facility,
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
        engine: GameEngine = current_app.config["engine"]
        ticks_per_hour = 3600 / engine.in_game_seconds_per_tick
        capacities = self.data.capacities
        extraction_facilities: list[ActiveFacility] = self.active_facilities.filter(
            ActiveFacility.facility.in_(engine.extraction_facilities),
        ).all()
        extraction_facility_groups: dict[str, list[ActiveFacility]] = defaultdict(list)
        for extraction_facility in extraction_facilities:
            extraction_facility_groups[extraction_facility.facility].append(extraction_facility)
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
                    "facility": extraction_facility.facility,
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
        if power_facilities and "power_facilities_data" in self.cache.__dict__:
            del self.cache.power_facilities_data
        if storage_facilities and "storage_facilities_data" in self.cache.__dict__:
            del self.cache.storage_facilities_data
        if extraction_facilities and "extraction_facilities_data" in self.cache.__dict__:
            del self.cache.extraction_facilities_data
        if functional_facilities and "functional_facilities_data" in self.cache.__dict__:
            del self.cache.functional_facilities_data
        if technologies and "technologies_data" in self.cache.__dict__:
            del self.cache.technologies_data
        if self.socketio_clients:
            # TODO(mglst): update clients over websocket
            pages_data = {}
            if power_facilities:
                pages_data |= {"power_facilities": self.cache.power_facilities_data}
            if storage_facilities:
                pages_data |= {"storage_facilities": self.cache.storage_facilities_data}
            if extraction_facilities:
                pages_data |= {"extraction_facilities": self.cache.extraction_facilities_data}
            if functional_facilities:
                pages_data |= {"functional_facilities": self.cache.functional_facilities_data}
            if technologies:
                pages_data |= {"technologies": self.cache.technologies_data}
            self.emit("update_page_data", pages_data)


class PlayerUnreadMessages(db.Model):
    """Association table to store player's last activity in each chat."""

    player_id = db.Column(db.Integer, db.ForeignKey("player.id"), primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey("message.id"), primary_key=True)
    player = db.relationship("Player", backref="read_messages")
    message = db.relationship("Message", backref="read_by_players")
