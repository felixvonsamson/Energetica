"""This module contains the classes that define the players and networks"""

import json
from itertools import chain

from flask import current_app
from flask_login import UserMixin
from pywebpush import WebPushException, webpush

from website import db
from website.database.messages import Chat, Message, Notification, player_chats
from website.database.player_assets import ActiveFacilities, UnderConstruction


class Player(db.Model, UserMixin):
    """Class that stores the users"""

    id = db.Column(db.Integer, primary_key=True)

    # Authentication :
    username = db.Column(db.String(25), unique=True)
    pwhash = db.Column(db.String(50))

    # Position :
    tile = db.relationship("Hex", uselist=False, backref="player")
    network_id = db.Column(db.Integer, db.ForeignKey("network.id"), default=None)

    # Chats :
    show_disclaimer = db.Column(db.Boolean, default=True)
    chats = db.relationship("Chat", secondary=player_chats, backref="participants")
    last_opened_chat = db.Column(db.Integer, default=None)
    messages = db.relationship("Message", backref="player")
    notifications = db.relationship("Notification", backref="players", lazy="dynamic")

    graph_view = db.Column(db.String(10), default="basic")

    # resources :
    money = db.Column(db.Float, default=25000)  # default is 25000
    coal = db.Column(db.Float, default=0)
    oil = db.Column(db.Float, default=0)
    gas = db.Column(db.Float, default=0)
    uranium = db.Column(db.Float, default=0)

    coal_on_sale = db.Column(db.Float, default=0)
    oil_on_sale = db.Column(db.Float, default=0)
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
    price_oil_burner = db.Column(db.Float, default=550)
    price_gas_burner = db.Column(db.Float, default=500)
    price_combined_cycle = db.Column(db.Float, default=450)
    price_nuclear_reactor = db.Column(db.Float, default=275)
    price_nuclear_reactor_gen4 = db.Column(db.Float, default=375)

    # Storage capacity prices [¤/MWh]
    price_buy_small_pumped_hydro = db.Column(db.Float, default=210)
    price_small_pumped_hydro = db.Column(db.Float, default=790)
    price_buy_compressed_air = db.Column(db.Float, default=270)
    price_compressed_air = db.Column(db.Float, default=860)
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
    price_buy_oil_field = db.Column(db.Float, default=970)
    price_buy_gas_drilling_site = db.Column(db.Float, default=980)
    price_buy_uranium_mine = db.Column(db.Float, default=990)
    price_buy_carbon_capture = db.Column(db.Float, default=660)

    # player progression data :
    xp = db.Column(db.Integer, default=0)
    emissions = db.Column(db.Float, default=0)
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

    advancements = db.Column(db.Text, default="")
    # advancements include
    # * "network"
    # * "technology"
    # * "warehouse"
    # * "GHG_effect"
    # * "storage_overview"
    achievements = db.Column(db.Text, default="")

    under_construction = db.relationship("UnderConstruction")
    resource_on_sale = db.relationship("ResourceOnSale", backref="player")
    shipments = db.relationship("Shipment", backref="player")
    active_facilities = db.relationship("ActiveFacilities", backref="player", lazy="dynamic")

    def change_graph_view(self, view):
        """Helper method to set the network graph view of the player (basic/normal/expert)"""
        self.graph_view = view
        db.session.commit()

    def available_construction_workers(self):
        """Returns the number of available construction workers"""
        occupied_workers = (
            UnderConstruction.query.filter(UnderConstruction.player_id == self.id)
            .filter(UnderConstruction.family != "Technologies")
            .filter(UnderConstruction.suspension_time.is_(None))
            .count()
        )
        return self.construction_workers - occupied_workers

    def available_lab_workers(self):
        """Returns the number of available lab workers"""
        occupied_workers = (
            UnderConstruction.query.filter(UnderConstruction.player_id == self.id)
            .filter(UnderConstruction.family == "Technologies")
            .filter(UnderConstruction.suspension_time.is_(None))
            .count()
        )
        return self.lab_workers - occupied_workers

    def read_list(self, attr):
        """Helper method thar returns a list of any player list that is stored as a string"""
        if getattr(self, attr) == "":
            return []
        priority_list = getattr(self, attr).split(",")
        if attr in ["construction_priorities", "research_priorities"]:
            return list(map(int, priority_list))
        else:
            return priority_list

    def add_to_list(self, attr, value):
        """Helper method that adds an element to a list stored as a string"""
        if getattr(self, attr) == "":
            setattr(self, attr, str(value))
        else:
            setattr(self, attr, getattr(self, attr) + f",{value}")
        db.session.commit()
        if attr == "advancements":
            # TODO: I don't like how this is done. -Max
            from website.api.websocket import rest_notify_advancements

            engine = current_app.config["engine"]
            rest_notify_advancements(engine, self)

    def remove_from_list(self, attr, value):
        """Helper method that removes an element from a list stored as a string"""
        id_list = getattr(self, attr).split(",")
        id_list.remove(str(value))
        setattr(self, attr, ",".join(id_list))
        db.session.commit()

    def project_max_priority(self, attr, project_id):
        """the project with the corresponding id will be moved to the top of the priority list"""
        self.remove_from_list(attr, project_id)
        if getattr(self, attr) == "":
            setattr(self, attr, str(project_id))
        else:
            setattr(self, attr, f"{project_id}," + getattr(self, attr))
        db.session.commit()

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
        attributes = chain(
            engine.functional_facilities,
            engine.technologies,
        )
        return {attr: getattr(self, attr) for attr in attributes}

    def get_reserves(self):
        """This method returns the natural resources reserves of a player"""
        reserves = {}
        for resource in ["coal", "oil", "gas", "uranium"]:
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
                "money": self.money,
            },
        )

    def send_notification(self, notification_data):
        """This method sends a notification to the player's clients and subscribed browsers"""
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
        from typing import List

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
                "co2_emissions": player.emissions,
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
                    "start_time",
                    "duration",
                    "suspension_time",
                ]
            }
            | {"display_name": current_app.config["engine"].const_config["assets"][construction.name]["name"]}
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
                    "departure_time",
                    "duration",
                    "suspension_time",
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
            sub_facilities = self.active_facilities.filter(ActiveFacilities.facility.in_(facilities)).all()
            return {
                facility.id: {
                    k: getattr(facility, k)
                    for k in [
                        "facility",
                        "end_of_life",
                        "price_multiplier",
                        "power_multiplier",
                        "capacity_multiplier",
                        "efficiency_multiplier",
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
