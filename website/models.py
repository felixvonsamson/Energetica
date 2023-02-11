from . import db
from flask_login import UserMixin
from sqlalchemy.sql import func


#class Note(db.Model):
#    id = db.Column(db.Integer, primary_key=True)
#    data = db.Column(db.String(10000))
#    date = db.Column(db.DateTime(timezone=True), default=func.now())
#    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))


class User(db.Model, UserMixin):
    # Authentification :
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(25), unique=True)
    password = db.Column(db.String(25))
    #notes = db.relationship('Note')# to be removed

    # Position :
    q = db.Column(db.Integer)
    r = db.Column(db.Integer)

    # Ressources :
    money = db.Column(db.Integer, default=0)
    coal = db.Column(db.Integer, default=0)
    oil = db.Column(db.Integer, default=0)
    gas = db.Column(db.Integer, default=0)
    uranium = db.Column(db.Integer, default=0)

    # Energy buildings :
    biomass_burner = db.Column(db.Integer, default=0)
    windmill = db.Column(db.Integer, default=0)
    watermill = db.Column(db.Integer, default=0)
    coal_burner = db.Column(db.Integer, default=0)
    oil_burner = db.Column(db.Integer, default=0)
    gas_burner = db.Column(db.Integer, default=0)
    shallow_geothermal_plant = db.Column(db.Integer, default=0)
    small_water_dam = db.Column(db.Integer, default=0)
    small_wind_turbine = db.Column(db.Integer, default=0)
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
    lithium_ion_batteries = db.Column(db.Integer, default=0)
    solid_state_batteries = db.Column(db.Integer, default=0)

    # Other buildings :
    laboratory = db.Column(db.Integer, default=0)
    warehouse = db.Column(db.Integer, default=0)
    military_barracks = db.Column(db.Integer, default=0)
    coal_mine = db.Column(db.Integer, default=0)
    oil_field = db.Column(db.Integer, default=0)
    gas_drilling_site = db.Column(db.Integer, default=0)
    uranium_mine = db.Column(db.Integer, default=0)
    uranium_rafinery = db.Column(db.Integer, default=0)
    
    # Technology :
    mineral_extraction = db.Column(db.Integer, default=0)
    civil_engeneering = db.Column(db.Integer, default=0)
    physics = db.Column(db.Integer, default=0)
    materials = db.Column(db.Integer, default=0)
    enviromental_science = db.Column(db.Integer, default=0)
    transport_technology = db.Column(db.Integer, default=0)
    




