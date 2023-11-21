"""
Here are defined the classes for the items stored in the database
"""

from . import db
from flask_login import UserMixin
from flask import current_app
from sqlalchemy.sql import func
import pickle
from datetime import datetime

# table that links chats to players
player_chats = db.Table('player_chats',
                db.Column('player_id', db.Integer, db.ForeignKey('player.id')),
                db.Column('chat_id', db.Integer, db.ForeignKey('chat.id'))
                )

# class for the tiles that compose the map :
class Hex(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    q = db.Column(db.Integer)
    r = db.Column(db.Integer)
    solar = db.Column(db.Integer)
    wind = db.Column(db.Integer)
    hydro = db.Column(db.Integer)
    coal = db.Column(db.Integer)
    oil = db.Column(db.Integer)
    gas = db.Column(db.Integer)
    uranium = db.Column(db.Integer)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"), default=None) # ID of the owner of the tile

    def __repr__(self):
        return f'<Tile {self.id} wind {self.wind}>'

# class that stores the things currently under construction :
class Under_construction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    family = db.Column(db.String(50)) # to assign the thing to the correct page
    start_time = db.Column(db.Float)
    finish_time = db.Column(db.Float)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id")) # can access player directly with .player

# class that stores the ressources shippment on their way :
class Shipment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    resource = db.Column(db.String(10))
    quantity = db.Column(db.Float)
    departure_time = db.Column(db.Float)
    arrival_time = db.Column(db.Float)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id")) # can access player directly with .player

class Resource_on_sale(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    resource = db.Column(db.String(10))
    quantity = db.Column(db.Float)
    price = db.Column(db.Float)
    creation_date = db.Column(db.DateTime, default=datetime.now())
    player_id = db.Column(db.Integer, db.ForeignKey("player.id")) # can access player directly with .player

# class that stores the networks of players :
class Network(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True)
    members = db.relationship('Player', backref='network')


# class that stores the users :
class Player(db.Model, UserMixin):

    # Authentification :
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(25), unique=True)
    password = db.Column(db.String(25))
    sid = db.Column(db.String(100))

    # Position :
    tile = db.relationship("Hex", backref='player')
    network_id = db.Column(db.Integer, db.ForeignKey("network.id"), default=None)

    # Chats :
    show_disclamer = db.Column(db.Boolean, default=True)
    chats = db.relationship('Chat', secondary=player_chats,
                            backref='participants')
    messages = db.relationship('Message', backref='player')

    # Ressources :
    money = db.Column(db.Float, default=30000) # default is 3000
    coal = db.Column(db.Float, default=0)
    oil = db.Column(db.Float, default=0)
    gas = db.Column(db.Float, default=0)
    uranium = db.Column(db.Float, default=0)

    coal_on_sale = db.Column(db.Float, default=0)
    oil_on_sale = db.Column(db.Float, default=0)
    gas_on_sale = db.Column(db.Float, default=0)
    uranium_on_sale = db.Column(db.Float, default=0)

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

    # Extraction plants :
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

    # Selfconsumption priority list 
    self_consumption_priority = db.Column(db.Text, default="small_water_dam large_water_dam watermill onshore_wind_turbine offshore_wind_turbine windmill CSP_solar PV_solar")
    rest_of_priorities = db.Column(db.Text, default="steam_engine nuclear_reactor nuclear_reactor_gen4 combined_cycle gas_burner oil_burner coal_burner")

    # Production capacity prices [¤/MWh]
    price_steam_engine = db.Column(db.Float, default=125)
    price_coal_burner = db.Column(db.Float, default=600)
    price_oil_burner = db.Column(db.Float, default=550)
    price_gas_burner = db.Column(db.Float, default=500)
    price_combined_cycle = db.Column(db.Float, default=450)
    price_nuclear_reactor = db.Column(db.Float, default=275)
    price_nuclear_reactor_gen4 = db.Column(db.Float, default=375)

    # Storage capacity prices [¤/MWh]
    price_buy_small_pumped_hydro = db.Column(db.Float, default=150)
    price_sell_small_pumped_hydro = db.Column(db.Float, default=250)
    price_buy_compressed_air = db.Column(db.Float, default=70)
    price_sell_compressed_air = db.Column(db.Float, default=110)
    price_buy_molten_salt = db.Column(db.Float, default=80)
    price_sell_molten_salt = db.Column(db.Float, default=125)
    price_buy_large_pumped_hydro = db.Column(db.Float, default=65)
    price_sell_large_pumped_hydro = db.Column(db.Float, default=100)
    price_buy_hydrogen_storage = db.Column(db.Float, default=100)
    price_sell_hydrogen_storage = db.Column(db.Float, default=200)
    price_buy_lithium_ion_batteries = db.Column(db.Float, default=400)
    price_sell_lithium_ion_batteries = db.Column(db.Float, default=500)
    price_buy_solid_state_batteries = db.Column(db.Float, default=175)
    price_sell_solid_state_batteries = db.Column(db.Float, default=500)

    # CO2 emissions :
    emissions = db.Column(db.Float, default=0)

    under_construction = db.relationship("Under_construction")
    resource_on_sale = db.relationship("Resource_on_sale", backref='player')
    shipments = db.relationship("Shipment", backref='player')

    data_table_name = db.Column(db.String(50))
    
    def emit(player, *args):
        if player.sid:
            socketio = current_app.config["engine"].socketio
            socketio.emit(*args, room=player.sid)

    def update_resources(player):
        if player.sid:
            updates = []
            updates.append(["money", f"{player.money:,.0f}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>".replace(",", "'")])
            player.emit("update_data", updates)

    # prints out the object as a sting with the players username for debugging
    def __repr__(self):
        return f'<Player {self.username}>'

# class that stores chats with 2 or more players :
class Chat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    messages = db.relationship('Message', backref='chat')

# class that stores messages :
class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text)
    time = db.Column(db.DateTime, default=datetime.now())
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))
    chat_id = db.Column(db.Integer, db.ForeignKey("chat.id"))