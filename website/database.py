from . import db
from flask_login import UserMixin
from sqlalchemy.sql import func    


class Under_construction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    family = db.Column(db.String(50))
    start_time = db.Column(db.Integer)
    finish_time = db.Column(db.Integer)
    player_id = db.Column(db.Integer, db.ForeignKey('player.id'))


class Player(db.Model, UserMixin):
    # Authentification :
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(25), unique=True)
    password = db.Column(db.String(25))
    sid = db.Column(db.String(100))

    # Position :
    q = db.Column(db.Integer)
    r = db.Column(db.Integer)

    # Ressources :
    money = db.Column(db.Integer, default=100000)
    coal = db.Column(db.Integer, default=1000000)
    oil = db.Column(db.Integer, default=500000)
    gas = db.Column(db.Integer, default=700000)
    uranium = db.Column(db.Integer, default=10000)

    # Energy buildings :
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

    # Storage buildings :
    small_pumped_hydro = db.Column(db.Integer, default=0)
    compressed_air = db.Column(db.Integer, default=0)
    molten_salt = db.Column(db.Integer, default=0)
    large_pumped_hydro = db.Column(db.Integer, default=0)
    hydrogen_storage = db.Column(db.Integer, default=0)
    lithium_ion_batteries = db.Column(db.Integer, default=0)
    solid_state_batteries = db.Column(db.Integer, default=0)

    # Functional buildings :
    laboratory = db.Column(db.Integer, default=0)
    warehouse = db.Column(db.Integer, default=0)
    industry = db.Column(db.Integer, default=0)
    military_barracks = db.Column(db.Integer, default=0)

    # Extraction plants
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

    # Capacities :
    c_fossil = db.Column(db.Integer, default=0)
    c_wind = db.Column(db.Integer, default=0)
    c_hydro = db.Column(db.Integer, default=0)
    c_geothermal = db.Column(db.Integer, default=0)
    c_nuclear = db.Column(db.Integer, default=0)
    c_solar = db.Column(db.Integer, default=0)
    c_pumped_hydro = db.Column(db.Integer, default=0)
    c_compressed_air = db.Column(db.Integer, default=0)
    c_molten_salt = db.Column(db.Integer, default=0)
    c_hydrogen = db.Column(db.Integer, default=0)
    c_batteries = db.Column(db.Integer, default=0)

    # CO2 emissions :
    emissions = db.Column(db.Integer, default=0)
    total_emissions = db.Column(db.Integer, default=0)

    under_construction = db.relationship('Under_construction')

    production_table_name = db.Column(db.String(50))

    todays_production = {
        "production" : {
            "fossil" : [0]*1440,
            "wind" : [0]*1440,
            "hydro" : [0]*1440,
            "geothermal" : [0]*1440,
            "nuclear" : [0]*1440,
            "solar" : [0]*1440
        },
        "demand" : {
            "industriy" : [0]*1440,
            "construction" : [0]*1440,
            "extraction_plants" : [0]*1440,
            "research" : [0]*1440,
            "storage" : [0]*1440
        },
        "storage" : {
            "pumped_hydro" : [0]*1440,
            "compressed_air" : [0]*1440,
            "molten_salt" : [0]*1440,
            "hydrogen" : [0]*1440,
            "batteries" : [0]*1440
        },
        "ressources" : {
            "coal" : [0]*24,
            "oil" : [0]*24,
            "gas" : [0]*24,
            "uranium" : [0]*24
        },
        "emissions" : [0]*24
    }




