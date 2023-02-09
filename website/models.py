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
    money = db.Column(db.Integer)
    coal = db.Column(db.Integer)
    oil = db.Column(db.Integer)
    gas = db.Column(db.Integer)
    uranium = db.Column(db.Integer)

    # Energy buildings :
    biomass_burner = db.Column(db.Integer)
    windmill = db.Column(db.Integer)
    watermill = db.Column(db.Integer)
    coal_burner = db.Column(db.Integer)
    oil_burner = db.Column(db.Integer)
    gas_burner = db.Column(db.Integer)
    shallow_geothermal_plant = db.Column(db.Integer)
    small_water_dam = db.Column(db.Integer)
    small_wind_turbine = db.Column(db.Integer)
    combined_cycle = db.Column(db.Integer)
    deep_geothermal_plant = db.Column(db.Integer)
    nuclear_reactor = db.Column(db.Integer)
    large_water_dam = db.Column(db.Integer)
    CSP_solar = db.Column(db.Integer)
    PV_solar = db.Column(db.Integer)
    large_wind_turbine = db.Column(db.Integer)
    nuclear_reactor_gen4 = db.Column(db.Integer)

    # Storage buildings :
    small_pumped_hydro = db.Column(db.Integer)
    compressed_air = db.Column(db.Integer)
    molten_salt = db.Column(db.Integer)
    large_pumped_hydro = db.Column(db.Integer)
    lithium_ion_batteries = db.Column(db.Integer)
    solid_state_batteries = db.Column(db.Integer)

    # Other buildings :
    laboratory = db.Column(db.Integer)
    warehouse = db.Column(db.Integer)
    military_barracks = db.Column(db.Integer)
    coal_mine = db.Column(db.Integer)
    oil_field = db.Column(db.Integer)
    gas_drilling_site = db.Column(db.Integer)
    uranium_mine = db.Column(db.Integer)
    uranium_rafinery = db.Column(db.Integer)
    
    # Technology :
    mineral_extraction = db.Column(db.Integer)
    civil_engeneering = db.Column(db.Integer)
    physics = db.Column(db.Integer)
    materials = db.Column(db.Integer)
    enviromental_science = db.Column(db.Integer)
    transport_technology = db.Column(db.Integer)
    




