"""This module contains the classes that define the players and networks"""

import json
from datetime import datetime
from itertools import chain
from typing import List

from flask import current_app
from flask_login import UserMixin
from pywebpush import WebPushException, webpush

from website import db
from website.config.achievements import achievements
from website.database.messages import Chat, Message, Notification, player_chats
from website.database.player_assets import ActiveFacility, OngoingConstruction


class Player(db.Model, UserMixin):
    """Class that stores the users"""

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

    # Functional facilities :
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
    self_consumption_priority = db.Column(db.Text, default="")
    rest_of_priorities = db.Column(db.Text, default="steam_engine")
    demand_priorities = db.Column(db.Text, default="industry,construction")
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
    captured_CO2 = db.Column(db.Float, default=0)

    achievements = db.Column(db.Text, default="")

    under_construction = db.relationship("OngoingConstruction")
    resource_on_sale = db.relationship("ResourceOnSale", backref="player")
    shipments = db.relationship("Shipment", backref="player")
    active_facilities = db.relationship("ActiveFacility", backref="player", lazy="dynamic")
    climate_events = db.relationship("ClimateEventRecovery", backref="player")

    def change_graph_view(self, view):
        """Helper method to set the network graph view of the player (basic/normal/expert)"""
        self.graph_view = view
        db.session.commit()

    def available_workers(self, project_type):
        """Returns the number of available workers depending on the project type"""
        if project_type == "Technologies":
            return self.available_lab_workers()
        else:
            return self.available_construction_workers()

    def available_construction_workers(self):
        """Returns the number of available construction workers"""
        occupied_workers = (
            OngoingConstruction.query.filter(OngoingConstruction.player_id == self.id)
            .filter(OngoingConstruction.family != "Technologies")
            .filter(OngoingConstruction.status == 2)
            .count()
        )
        return self.construction_workers - occupied_workers

    def available_lab_workers(self):
        """Returns the number of available lab workers"""
        occupied_workers = (
            OngoingConstruction.query.filter(OngoingConstruction.player_id == self.id)
            .filter(OngoingConstruction.family == "Technologies")
            .filter(OngoingConstruction.status == 2)
            .count()
        )
        return self.lab_workers - occupied_workers

    def read_list(self, attr):
        """Helper method that returns a list of any player list that is stored as a string"""
        if getattr(self, attr) == "":
            return []
        priority_list = getattr(self, attr).split(",")
        if attr in ["construction_priorities", "research_priorities"]:
            return list(map(int, priority_list))
        else:
            return priority_list

    def write_list(self, attr, list):
        """Helper method that writes a list of any player list that is stored as a string"""
        setattr(self, attr, ",".join(map(str, list)))

    def add_to_list(self, attr, value):
        """Helper method that adds an element to a list stored as a string"""
        if getattr(self, attr) == "":
            setattr(self, attr, str(value))
        else:
            setattr(self, attr, getattr(self, attr) + f",{value}")
        if attr == "achievements":
            # TODO: I don't like how this is done. -Max
            from website.api.websocket import rest_notify_achievements

            engine = current_app.config["engine"]
            rest_notify_achievements(engine, self)

    def remove_from_list(self, attr, value):
        """Helper method that removes an element from a list stored as a string"""
        id_list = getattr(self, attr).split(",")
        id_list.remove(str(value))
        setattr(self, attr, ",".join(id_list))

    def project_max_priority(self, attr, project_id):
        """the project with the corresponding id will be moved to the top of the priority list"""
        self.remove_from_list(attr, project_id)
        if getattr(self, attr) == "":
            setattr(self, attr, str(project_id))
        else:
            setattr(self, attr, f"{project_id}," + getattr(self, attr))

    def package_chat_messages(self, chat_id):
        """This method packages the last 20 messages of a chat"""
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

    def package_chat_list(self):
        """This method packages the chats of a player"""

        def chat_name(chat):
            if chat.name is not None:
                return chat.name
            for participant in chat.participants:
                if participant != self:
                    return participant.username
            return None

        def find_initials(chat):
            if chat.name is None:
                for participant in chat.participants:
                    if participant != self:
                        return participant.username[0]
            initials = []
            for participant in chat.participants:
                initials.append(participant.username[0])
                if len(initials) == 4:
                    break
            return initials

        def unread_message_count(chat):
            unread_messages_count = (
                PlayerUnreadMessages.query.join(Message, PlayerUnreadMessages.message_id == Message.id)
                .filter(PlayerUnreadMessages.player_id == self.id)
                .filter(Message.chat_id == chat.id)
                .count()
            )
            return unread_messages_count

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
            "response": "success",
            "chat_list": chat_dict,
            "last_opened_chat": self.last_opened_chat,
        }

    def package_chats(self):
        """This method packages chats for the iOS frontend"""
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

    def delete_notification(self, notification_id):
        """This method deletes a notification"""
        notification = Notification.query.get(notification_id)
        if notification in self.notifications.all():
            db.session.delete(notification)
            db.session.commit()

    def notifications_read(self):
        """This method marks all notifications as read"""
        for notification in self.unread_notifications():
            notification.read = True
        db.session.commit()

    def unread_notifications(self):
        """This method returns all unread notifications"""
        return self.notifications.filter_by(read=False).all()

    def get_lvls(self):
        """This method returns the levels of functional facilities and technologies of a player"""
        engine = current_app.config["engine"]
        attributes = chain(engine.functional_facilities, engine.technologies)
        return {attr: getattr(self, attr) for attr in attributes}

    def get_reserves(self):
        """This method returns the natural resources reserves of a player"""
        reserves = {}
        for resource in ["coal", "gas", "uranium"]:
            reserves[resource] = getattr(self.tile, resource)
        return reserves

    def emit(self, event, *args):
        """This method emits a socketio event to the player's clients"""
        engine = current_app.config["engine"]
        for sid in engine.clients[self.id]:
            engine.socketio.emit(event, *args, room=sid)

    def send_new_data(self, new_values):
        """This method sends the new data to the player's clients"""
        engine = current_app.config["engine"]
        self.emit(
            "new_values",
            {
                "total_t": engine.data["total_t"],
                "chart_values": new_values,
                "climate_values": engine.data["current_climate_data"].get_last_data(),
                "cumulative_emissions": engine.data["player_cumul_emissions"][self.id].get_all(),
                "money": self.money,
            },
        )

    def notify(self, title, message):
        """Creates a new notification and sends it to the player's subscribed browsers"""
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
        if self.notifications.count() > 1:
            if (
                new_notification.content == self.notifications[self.notifications.count() - 2].content
                and new_notification.time == self.notifications[self.notifications.count() - 2].time
            ):
                return
        notification_data = {
            "title": new_notification.title,
            "body": new_notification.content,
        }
        engine = current_app.config["engine"]
        for subscription in engine.notification_subscriptions[self.id]:
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
                print(f"Failed to send notification: {repr(ex)}")

    def calculate_net_emissions(self):
        """Calculates the net emissions of the player"""
        cumulative_emissions = current_app.config["engine"].data["player_cumul_emissions"][self.id].get_all()
        net_emissions = 0
        for value in cumulative_emissions.values():
            net_emissions += value
        return net_emissions

    def check_continuous_achievements(self):
        """Check for player achievements that are linked to values that are updated every tick"""
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
                    if getattr(self, achievements[achievement]["metric"]) >= value:
                        self.add_to_list("achievements", f"{achievement_name} {i+1}")
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

    def check_construction_achievements(self, construction_name):
        """Check for player achievements that may be unlocked by a construction"""
        for achievement in ["laboratory", "warehouse", "GHG_effect", "storage_facilities"]:
            achievement_name = achievements[achievement]["name"]
            if achievement_name not in self.achievements:
                if construction_name in achievements[achievement]["unlocked_with"]:
                    self.add_to_list("achievements", achievement_name)
                    self.xp += achievements[achievement]["reward"]
                    message = achievements[achievement]["message"].format(reward=achievements[achievement]["reward"])
                    self.notify("Achievement", message)

    def check_technology_achievement(self):
        """Check for technology achievement"""
        achievement_name = achievements["technology"]["name"]
        for i, value in enumerate(achievements["technology"]["milestones"]):
            if f"{achievement_name} {i+1}" not in self.achievements:
                if getattr(self, achievements["technology"]["metric"]) >= value:
                    self.add_to_list("achievements", f"{achievement_name} {i+1}")
                    self.xp += achievements["technology"]["rewards"][i]
                    message = achievements["technology"]["message"].format(
                        value=value, reward=achievements["technology"]["rewards"][i]
                    )
                    self.notify("Achievement", message)

    def check_trading_achievement(self):
        """Check for trading achievement"""
        achievement_name = achievements["trading"]["name"]
        for i, value in enumerate(achievements["trading"]["milestones"]):
            if f"{achievement_name} {i+1}" not in self.achievements:
                if (
                    getattr(self, achievements["trading"]["metric"][0])
                    + getattr(self, achievements["trading"]["metric"][1])
                    >= value
                ):
                    self.add_to_list("achievements", f"{achievement_name} {i+1}")
                    self.xp += achievements["trading"]["rewards"][i]
                    message = achievements["trading"]["message"].format(
                        value=value, reward=achievements["trading"]["rewards"][i]
                    )
                    self.notify("Achievement", message)

    def package_upcoming_achievements(self):
        """Packages the progress information for the upcoming achievements"""
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
                            status = getattr(self, achievement_data["metric"][0]) + getattr(
                                self, achievement_data["metric"][1]
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

    # prints out the object as a sting with the players username for debugging
    def __repr__(self):
        return f"<Player {self.id} '{self.username}'>"

    def package(self):
        """Serialize select attributes of self to a dictionary"""
        return (
            {
                "id": self.id,
                "username": self.username,
            }
            | ({"network_id": self.network_id} if self.network_id is not None else {})
            | ({"cell_id": self.tile.id} if self.tile is not None else {})
        )

    @staticmethod
    def package_all():
        """Gets the package data for all players"""
        players: List[Player] = Player.query.all()
        return {player.id: player.package() for player in players}

    @staticmethod
    def package_scoreboard():
        """Gets the scoreboard data for settled players"""
        players = Player.query.filter(Player.tile != None)
        return {
            player.id: {
                "username": player.username,
                "network_name": player.network.name if player.network else "-",
                "average_hourly_revenues": player.average_revenues,
                "max_power_consumption": player.max_power_consumption,
                "total_technology_levels": player.total_technologies,
                "xp": player.xp,
                "co2_emissions": player.calculate_net_emissions(),
            }
            for player in players
        }

    def package_constructions(self):
        """Packages the player's ongoing constructions"""
        return {
            construction.id: {
                k: getattr(construction, k)
                for k in [
                    "id",
                    "name",
                    "family",
                    "_end_tick_or_ticks_passed",
                    "duration",
                    "status",
                ]
            }
            | {"display_name": current_app.config["engine"].const_config["assets"][construction.name]["name"]}
            | ({"level": construction.level()} if construction.level() >= 0 else {})
            for construction in self.under_construction
        }

    def package_shipments(self):
        """Packages the player's ongoing shipments"""
        return {
            shipment.id: {
                k: getattr(shipment, k)
                for k in [
                    "id",
                    "resource",
                    "quantity",
                    "arrival_tick",
                    "duration",
                    "pause_tick",
                ]
            }
            for shipment in self.shipments
        }

    def package_construction_queue(self):
        """Packages the player's construction queue (list of construction_ids)"""
        return self.read_list("construction_priorities")

    def package_active_facilities(self):
        """Packages the player's active facilities"""

        def get_facility_data(facilities):
            sub_facilities: List[ActiveFacility] = self.active_facilities.filter(
                ActiveFacility.facility.in_(facilities)
            ).all()
            return {
                facility.id: {
                    k: getattr(facility, k)
                    for k in [
                        "facility",
                        "end_of_life",
                        "price_multiplier",
                        "multiplier_1",
                        "multiplier_2",
                        "multiplier_3",
                        "usage",
                    ]
                }
                for facility in sub_facilities
            }

        engine = current_app.config["engine"]
        return {
            "power_facilities": get_facility_data(engine.power_facilities),
            "storage_facilities": get_facility_data(engine.storage_facilities),
            "extraction_facilities": get_facility_data(engine.extraction_facilities),
        }


class Network(db.Model):
    """class that stores the networks of players"""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True)
    members = db.relationship("Player", backref="network")


class PlayerUnreadMessages(db.Model):
    """Association table to store player's last activity in each chat"""

    player_id = db.Column(db.Integer, db.ForeignKey("player.id"), primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey("message.id"), primary_key=True)
    player = db.relationship("Player", backref="read_messages")
    message = db.relationship("Message", backref="read_by_players")
