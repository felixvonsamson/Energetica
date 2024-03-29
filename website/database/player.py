from website import db
from website.database.player_assets import (
    Under_construction,
)


from flask import current_app
from flask_login import UserMixin

from website.database.messages import (
    Notification,
    player_chats,
    player_notifications,
)


class Player(db.Model, UserMixin):
    """Class that stores the users"""

    id = db.Column(db.Integer, primary_key=True)

    # Authentification :
    username = db.Column(db.String(25), unique=True)
    pwhash = db.Column(db.String(25))

    # Position :
    tile = db.relationship("Hex", uselist=False, backref="player")
    network_id = db.Column(
        db.Integer, db.ForeignKey("network.id"), default=None
    )

    # Chats :
    show_disclamer = db.Column(db.Boolean, default=True)
    chats = db.relationship(
        "Chat", secondary=player_chats, backref="participants"
    )
    messages = db.relationship("Message", backref="player")
    notifications = db.relationship(
        "Notification", secondary=player_notifications, backref="players"
    )

    # resources :
    money = db.Column(db.Float, default=10000)  # default is 10000
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

    # Energy facilities :
    steam_engine = db.Column(db.Integer, default=1)
    windmill = db.Column(db.Integer, default=0)
    watermill = db.Column(db.Integer, default=0)
    coal_burner = db.Column(db.Integer, default=0)
    oil_burner = db.Column(db.Integer, default=0)
    gas_burner = db.Column(db.Integer, default=0)
    small_water_dam = db.Column(db.Integer, default=0)
    onshore_wind_turbine = db.Column(db.Integer, default=0)
    combined_cycle = db.Column(db.Integer, default=0)
    nuclear_reactor = db.Column(db.Integer, default=0)
    large_water_dam = db.Column(db.Integer, default=0)
    CSP_solar = db.Column(db.Integer, default=0)
    PV_solar = db.Column(db.Integer, default=0)
    offshore_wind_turbine = db.Column(db.Integer, default=0)
    nuclear_reactor_gen4 = db.Column(db.Integer, default=0)

    # Storage facilities :
    small_pumped_hydro = db.Column(db.Integer, default=0)
    compressed_air = db.Column(db.Integer, default=0)
    molten_salt = db.Column(db.Integer, default=0)
    large_pumped_hydro = db.Column(db.Integer, default=0)
    hydrogen_storage = db.Column(db.Integer, default=0)
    lithium_ion_batteries = db.Column(db.Integer, default=0)
    solid_state_batteries = db.Column(db.Integer, default=0)

    # Functional facilities :
    industry = db.Column(db.Integer, default=1)
    laboratory = db.Column(db.Integer, default=0)
    warehouse = db.Column(db.Integer, default=0)
    carbon_capture = db.Column(db.Integer, default=0)

    # Extraction facilities :
    coal_mine = db.Column(db.Integer, default=0)
    oil_field = db.Column(db.Integer, default=0)
    gas_drilling_site = db.Column(db.Integer, default=0)
    uranium_mine = db.Column(db.Integer, default=0)

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
    self_consumption_priority = db.Column(
        db.Text,
        default="",
    )
    rest_of_priorities = db.Column(
        db.Text,
        default="steam_engine",
    )
    demand_priorities = db.Column(
        db.Text,
        default="transport,industry,research,construction",
    )
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
    price_buy_industry = db.Column(db.Float, default=1200)
    price_buy_construction = db.Column(db.Float, default=1020)
    price_buy_research = db.Column(db.Float, default=1000)
    price_buy_transport = db.Column(db.Float, default=1050)
    price_buy_coal_mine = db.Column(db.Float, default=960)
    price_buy_oil_field = db.Column(db.Float, default=970)
    price_buy_gas_drilling_site = db.Column(db.Float, default=980)
    price_buy_uranium_mine = db.Column(db.Float, default=990)
    price_buy_carbon_capture = db.Column(db.Float, default=660)

    # CO2 emissions :
    emissions = db.Column(db.Float, default=0)
    average_revenues = db.Column(db.Float, default=0)

    under_construction = db.relationship("Under_construction")
    resource_on_sale = db.relationship("Resource_on_sale", backref="player")
    shipments = db.relationship("Shipment", backref="player")

    def available_construction_workers(self):
        occupied_workers = (
            Under_construction.query.filter(
                Under_construction.player_id == self.id
            )
            .filter(Under_construction.family != "Technologies")
            .filter(Under_construction.suspension_time.is_(None))
            .count()
        )
        return self.construction_workers - occupied_workers

    def available_lab_workers(self):
        occupied_workers = (
            Under_construction.query.filter(
                Under_construction.player_id == self.id
            )
            .filter(Under_construction.family == "Technologies")
            .filter(Under_construction.suspension_time.is_(None))
            .count()
        )
        return self.lab_workers - occupied_workers

    def read_project_priority(self, attr):
        if getattr(self, attr) == "":
            return []
        priority_list = getattr(self, attr).split(",")
        if attr in ["construction_priorities", "research_priorities"]:
            return list(map(int, priority_list))
        else:
            return priority_list

    def add_project_priority(self, attr, id):
        if getattr(self, attr) == "":
            setattr(self, attr, str(id))
        else:
            setattr(self, attr, getattr(self, attr) + f",{id}")
        db.session.commit()

    def remove_project_priority(self, attr, id):
        id_list = getattr(self, attr).split(",")
        id_list.remove(str(id))
        setattr(self, attr, ",".join(id_list))
        db.session.commit()

    def project_max_priority(self, attr, id):
        """the project with the corresponding id will be moved to the top of the prioirty list"""
        self.remove_project_priority(attr, id)
        if getattr(self, attr) == "":
            setattr(self, attr, str(id))
        else:
            setattr(self, attr, f"{id}," + getattr(self, attr))
        db.session.commit()

    def get_constructions(self):
        constructions = self.under_construction
        construction_list = {
            construction.id: {
                "name": construction.name,
                "family": construction.family,
                "start_time": construction.start_time,
                "duration": construction.duration,
                "suspension_time": construction.suspension_time,
            }
            for construction in constructions
        }
        return construction_list

    def delete_notification(self, notification_id):
        notification = Notification.query.get(notification_id)
        if notification in self.notifications:
            self.notifications.remove(notification)
            if not notification.players:
                db.session.delete(notification)
            db.session.commit()

    def notifications_read(self):
        for notification in self.unread_notifications():
            notification.read = True
        db.session.commit()

    def unread_notifications(self):
        return [
            notification
            for notification in self.notifications
            if not notification.read
        ]

    def get_values(self):
        engine = current_app.config["engine"]
        attributes = (
            engine.controllable_facilities
            + engine.renewables
            + engine.storage_facilities
            + engine.extraction_facilities
            + engine.functional_facilities
            + engine.technologies
        )
        return {attr: getattr(self, attr) for attr in attributes}

    def emit(self, event, *args):
        engine = current_app.config["engine"]
        if self.id in engine.clients:
            socketio = engine.socketio
            for sid in engine.clients[self.id]:
                socketio.emit(event, *args, room=sid)

    def send_new_data(self, new_values):
        engine = current_app.config["engine"]
        self.emit(
            "new_values",
            {
                "total_t": engine.data["total_t"],
                "chart_values": new_values,
                "money": "{:,.0f}".format(self.money).replace(",", "'"),
            },
        )

    # prints out the object as a sting with the players username for debugging
    def __repr__(self):
        return f"<Player {self.id} '{self.username}'>"

    def package(self):
        """Serialize select attributes of self to a dictionary"""
        payload = {
            "username": self.username,
        }
        if self.tile is not None:
            payload["tile_id"] = self.tile.id
        return payload

    @staticmethod
    def package_all():
        return {player.id: player.package() for player in Player.query.all()}

    def package_constructions(self):
        return {
            construction.id: {
                "id": construction.id,
                "name": construction.name,
                "family": construction.family,
                "start_time": construction.start_time,
                "duration": construction.duration,
                "suspension_time": construction.suspension_time,
            }
            for construction in self.under_construction
        }

    def package_construction_queue(self):
        return self.read_project_priority("construction_priorities")


class Network(db.Model):
    """class that stores the networks of players"""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True)
    members = db.relationship("Player", backref="network")
