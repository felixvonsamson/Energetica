"""
Here are defined the classes for the items stored in the database
"""

from . import db
from flask_login import UserMixin
from flask import current_app
from datetime import datetime

# table that links chats to players
player_chats = db.Table(
    "player_chats",
    db.Column("player_id", db.Integer, db.ForeignKey("player.id")),
    db.Column("chat_id", db.Integer, db.ForeignKey("chat.id")),
)


# class for the tiles that compose the map :
class Hex(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    q = db.Column(db.Integer)
    r = db.Column(db.Integer)
    solar = db.Column(db.Float)
    wind = db.Column(db.Float)
    hydro = db.Column(db.Integer)
    coal = db.Column(db.Float)
    oil = db.Column(db.Float)
    gas = db.Column(db.Float)
    uranium = db.Column(db.Float)
    player_id = db.Column(
        db.Integer, db.ForeignKey("player.id"), unique=True, nullable=True
    )  # ID of the owner of the tile

    def __repr__(self):
        return f"<Tile {self.id} wind {self.wind}>"


# class that stores the things currently under construction :
class Under_construction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    family = db.Column(db.String(50))  # to assign the thing to the correct page
    start_time = db.Column(db.Float)
    duration = db.Column(db.Float)
    suspension_time = db.Column(
        db.Float
    )  # time at witch the construction has been paused if it has
    original_price = db.Column(
        db.Float
    )  # Price of the construction on the time of start of construction
    player_id = db.Column(
        db.Integer, db.ForeignKey("player.id")
    )  # can access player directly with .player


# class that stores the resources shippment on their way :
class Shipment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    resource = db.Column(db.String(10))
    quantity = db.Column(db.Float)
    departure_time = db.Column(db.Float)
    duration = db.Column(db.Float)
    suspension_time = db.Column(
        db.Float, default=None
    )  # time at witch the shipment has been paused if it has
    player_id = db.Column(
        db.Integer, db.ForeignKey("player.id")
    )  # can access player directly with .player


class Resource_on_sale(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    resource = db.Column(db.String(10))
    quantity = db.Column(db.Float)
    price = db.Column(db.Float)
    creation_date = db.Column(db.DateTime, default=datetime.now())
    player_id = db.Column(
        db.Integer, db.ForeignKey("player.id")
    )  # can access player directly with .player


# class that stores the networks of players :
class Network(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True)
    members = db.relationship("Player", backref="network")


# class that stores the users :
class Player(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)

    # Authentification :
    username = db.Column(db.String(25), unique=True)
    pwhash = db.Column(db.String(25))

    # Socket.io
    sid = None

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

    # resources :
    money = db.Column(db.Float, default=5000)  # default is 5000
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
    lab_workers = db.Column(db.Integer, default=1)

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
        default="small_water_dam large_water_dam watermill onshore_wind_turbine offshore_wind_turbine windmill CSP_solar PV_solar",
    )
    rest_of_priorities = db.Column(
        db.Text,
        default="steam_engine nuclear_reactor large_pumped_hydro small_pumped_hydro molten_salt nuclear_reactor_gen4 compressed_air combined_cycle hydrogen_storage gas_burner solid_state_batteries lithium_ion_batteries oil_burner coal_burner",
    )
    demand_priorities = db.Column(
        db.Text,
        default="transport industry research construction uranium_mine gas_drilling_site oil_field coal_mine",
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
    price_hydrogen_storage = db.Column(db.Float, default=940)
    price_buy_lithium_ion_batteries = db.Column(db.Float, default=425)
    price_lithium_ion_batteries = db.Column(db.Float, default=999)
    price_buy_solid_state_batteries = db.Column(db.Float, default=420)
    price_solid_state_batteries = db.Column(db.Float, default=990)

    # Demand buying prices
    price_buy_industry = db.Column(db.Float, default=1008)
    price_buy_construction = db.Column(db.Float, default=1006)
    price_buy_research = db.Column(db.Float, default=1005)
    price_buy_transport = db.Column(db.Float, default=1007)
    price_buy_coal_mine = db.Column(db.Float, default=1001)
    price_buy_oil_field = db.Column(db.Float, default=1002)
    price_buy_gas_drilling_site = db.Column(db.Float, default=1003)
    price_buy_uranium_mine = db.Column(db.Float, default=1004)
    price_buy_carbon_capture = db.Column(db.Float, default=1000)

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
        return list(map(int, priority_list))

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

    def increase_project_priority(self, attr, id):
        """the construction with the coresponding id will move one spot up in the priority list"""
        id_list = getattr(self, attr).split(",")
        index = id_list.index(str(id))
        if index > 0 and index < len(id_list):
            id_list[index], id_list[index - 1] = (
                id_list[index - 1],
                id_list[index],
            )
        setattr(self, attr, ",".join(id_list))
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

    def get_technology_values(self):
        technology_attributes = [
            "laboratory",
            "mathematics",
            "mechanical_engineering",
            "thermodynamics",
            "physics",
            "building_technology",
            "mineral_extraction",
            "transport_technology",
            "materials",
            "civil_engineering",
            "aerodynamics",
            "chemistry",
            "nuclear_engineering",
        ]
        technology_values = {
            attr: getattr(self, attr) for attr in technology_attributes
        }
        return technology_values

    def emit(player, *args):
        if player.sid:
            socketio = current_app.config["engine"].socketio
            socketio.emit(*args, room=player.sid)

    def update_resources(player):
        if player.sid:
            updates = []
            updates.append(
                [
                    "money",
                    f"{player.money:,.0f}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>".replace(
                        ",", "'"
                    ),
                ]
            )
            player.emit("update_data", updates)

    # prints out the object as a sting with the players username for debugging
    def __repr__(self):
        return f"<Player {self.id} '{self.username}'>"


# class that stores chats with 2 or more players :
class Chat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    messages = db.relationship("Message", backref="chat")


# class that stores messages :
class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text)
    time = db.Column(db.DateTime, default=datetime.now())
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))
    chat_id = db.Column(db.Integer, db.ForeignKey("chat.id"))
