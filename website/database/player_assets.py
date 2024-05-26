"""
Here are defined the classes for the items stored in the database
"""

from .. import db


class Under_construction(db.Model):
    """class that stores the things currently under construction"""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    family = db.Column(db.String(50))
    # to assign the thing to the correct page
    start_time = db.Column(db.Float)
    duration = db.Column(db.Float)
    # time at witch the construction has been paused if it has else None
    suspension_time = db.Column(db.Float)
    # Price of the construction on the time of start of construction
    original_price = db.Column(db.Float)
    # Power consumed by the construction
    construction_power = db.Column(db.Float)
    # multipliers to keep track of the technology level at the time of the start of the constuction
    price_multiplier = db.Column(db.Float, default=1)
    power_multiplier = db.Column(db.Float, default=1)
    capacity_multiplier = db.Column(db.Float, default=1)
    efficiency_multiplier = db.Column(db.Float, default=1)
    # can access player directly with .player
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))
    


class Active_facilites(db.Model):
    """Class that stores the facilites on the server and their end of life time."""

    id = db.Column(db.Integer, primary_key=True)
    facility = db.Column(db.String(50))
    end_of_life = db.Column(db.Float)
    # time at witch the facility will be decomissioned
    initial_price = db.Column(db.Float)
    # multiply the base values by the folowing values
    price_multiplier = db.Column(db.Float)
    power_multiplier = db.Column(db.Float)
    capacity_multiplier = db.Column(db.Float)
    efficiency_multiplier = db.Column(db.Float)
    
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))


class Shipment(db.Model):
    """Class that stores the resources shipment on their way"""

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
    """Class that stores resources currently on sale"""

    id = db.Column(db.Integer, primary_key=True)
    resource = db.Column(db.String(10))
    quantity = db.Column(db.Float)
    price = db.Column(db.Float)
    creation_date = db.Column(db.DateTime)
    player_id = db.Column(
        db.Integer, db.ForeignKey("player.id")
    )  # can access player directly with .player
