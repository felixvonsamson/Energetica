"""
Here are defined the classes for the items stored in the database
"""

from . import db
from flask_login import UserMixin
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
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"), default=None) # ID of the owner oof the tile

# class that stores the things currently under construction :
class Under_construction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    family = db.Column(db.String(50)) # to assign the thing to the correct page
    start_time = db.Column(db.Integer)
    finish_time = db.Column(db.Integer)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))

# class that stores the users :
class Player(db.Model, UserMixin):

    # Authentification :
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(25), unique=True)
    password = db.Column(db.String(25))
    sid = db.Column(db.String(100))

    # Position :
    tile = db.relationship("Hex", backref='player')

    # Chats :
    show_disclamer = db.Column(db.Boolean, default=True)
    chats = db.relationship('Chat', secondary=player_chats,
                            backref='participants')
    messages = db.relationship('Message', backref='player')

    # Ressources :
    money = db.Column(db.Integer, default=100000)
    coal = db.Column(db.Integer, default=1000000)
    oil = db.Column(db.Integer, default=500000)
    gas = db.Column(db.Integer, default=700000)
    uranium = db.Column(db.Integer, default=10000)

    # Energy facilities :
    steam_engine = db.Column(db.Integer, default=0)
    windmill = db.Column(db.Integer, default=0)
    watermill = db.Column(db.Integer, default=0)
    coal_burner = db.Column(db.Integer, default=0)
    oil_burner = db.Column(db.Integer, default=0)
    gas_burner = db.Column(db.Integer, default=0)
    shallow_geothermal_plant = db.Column(db.Integer, default=0)
    small_water_dam = db.Column(db.Integer, default=0)
    wind_turbine = db.Column(db.Integer, default=0)
    combined_cycle = db.Column(db.Integer, default=0)
    deep_geothermal_plant = db.Column(db.Integer, default=0)
    nuclear_reactor = db.Column(db.Integer, default=0)
    large_water_dam = db.Column(db.Integer, default=0)
    CSP_solar = db.Column(db.Integer, default=0)
    PV_solar = db.Column(db.Integer, default=0)
    large_wind_turbine = db.Column(db.Integer, default=0)
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
    laboratory = db.Column(db.Integer, default=0)
    warehouse = db.Column(db.Integer, default=0)
    industry = db.Column(db.Integer, default=0)
    military_barracks = db.Column(db.Integer, default=0)

    # Extraction plants :
    coal_mine = db.Column(db.Integer, default=0)
    oil_field = db.Column(db.Integer, default=0)
    gas_drilling_site = db.Column(db.Integer, default=0)
    uranium_mine = db.Column(db.Integer, default=0)

    # Technology :
    mineral_extraction = db.Column(db.Integer, default=0)
    civil_engeneering = db.Column(db.Integer, default=0)
    mechanical_engeneering = db.Column(db.Integer, default=0)
    physics = db.Column(db.Integer, default=0)
    materials = db.Column(db.Integer, default=0)
    carbon_capture = db.Column(db.Integer, default=0)
    transport_technology = db.Column(db.Integer, default=0)
    aerodynamics = db.Column(db.Integer, default=0)
    geology = db.Column(db.Integer, default=0)

    # CO2 emissions :
    emissions = db.Column(db.Integer, default=0)
    total_emissions = db.Column(db.Integer, default=0)

    under_construction = db.relationship("Under_construction")

    production_table_name = db.Column(db.String(50))

    # TEMPORARY -> GENERATE NEW VALUES FOR EACH DAY 
    with open("website/static/data/industry_demand.pck", "rb") as file:
        industry_demand = pickle.load(file)

    # Stores the data of the production, demand, ressources and emmisions (past 24h)
    todays_production = {
        # MAYBE REDUCE TO [fossil, wind, hydro, geothermal, nuclear, solar] TO REDUCE FILE SIZE
        "production": {
            "steam_engine": [0] * 1440,
            "windmill": [0] * 1440,
            "watermill": [0] * 1440,
            "coal_burner": [0] * 1440,
            "oil_burner": [0] * 1440,
            "gas_burner": [0] * 1440,
            "shallow_geothermal_plant": [0] * 1440,
            "small_water_dam": [0] * 1440,
            "wind_turbine": [0] * 1440,
            "combined_cycle": [0] * 1440,
            "deep_geothermal_plant": [0] * 1440,
            "nuclear_reactor": [0] * 1440,
            "large_water_dam": [0] * 1440,
            "CSP_solar": [0] * 1440,
            "PV_solar": [0] * 1440,
            "large_wind_turbine": [0] * 1440,
            "nuclear_reactor_gen4": [0] * 1440,
        },
        "demand": {
            "industriy": [i * 50000 for i in industry_demand],
            "construction": [0] * 1440,
            # MAYBE GROUP AS "extraction_plants"
            "coal_mine": [0] * 1440,
            "oil_field": [0] * 1440,
            "gas_drilling_site": [0] * 1440,
            "uranium_mine": [0] * 1440,
            "research": [0] * 1440,
            # MAYBE GROUP AS "storage"
            "small_pumped_hydro": [0] * 1440,
            "compressed_air": [0] * 1440,
            "molten_salt": [0] * 1440,
            "large_pumped_hydro": [0] * 1440,
            "hydrogen_storage": [0] * 1440,
            "lithium_ion_batteries": [0] * 1440,
            "solid_state_batteries": [0] * 1440,
        },
        "storage": {
            # MAYBE GROUP AS "pumped_hydro"
            "small_pumped_hydro": [0] * 1440,
            "large_pumped_hydro": [0] * 1440,
            "compressed_air": [0] * 1440,
            "molten_salt": [0] * 1440,
            "hydrogen": [0] * 1440,
            # MAYBE GROUP AS "batteries"
            "lithium_ion_batteries": [0] * 1440,
            "solid_state_batteries": [0] * 1440,
        },
        "ressources": {
            "coal": [0] * 24,
            "oil": [0] * 24,
            "gas": [0] * 24,
            "uranium": [0] * 24,
        },
        "emissions": [0] * 24,
    }

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