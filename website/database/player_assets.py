"""Here are defined the classes for the items stored in the database"""

from .. import db


class Under_construction(db.Model):
    """class that stores the things currently under construction"""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    family = db.Column(db.String(50))
    # to assign the thing to the correct page
    start_time = db.Column(db.Integer)  # in game ticks
    duration = db.Column(db.Integer)  # in game ticks
    # time at witch the construction has been paused if it has else None
    suspension_time = db.Column(db.Integer)
    # Power consumed and emissions produced by the construction
    construction_power = db.Column(db.Float)
    construction_pollution = db.Column(db.Float)
    # multipliers to keep track of the technology level at the time of the start of the construction
    price_multiplier = db.Column(db.Float, default=1)
    power_multiplier = db.Column(db.Float, default=1)
    capacity_multiplier = db.Column(db.Float, default=1)
    efficiency_multiplier = db.Column(db.Float, default=1)
    # can access player directly with .player
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))


class Active_facilities(db.Model):
    """Class that stores the facilities on the server and their end of life time."""

    id = db.Column(db.Integer, primary_key=True)
    facility = db.Column(db.String(50))
    # time at witch the facility will be decommissioned
    end_of_life = db.Column(db.Integer)
    # multiply the base values by the following values
    price_multiplier = db.Column(db.Float)
    power_multiplier = db.Column(db.Float)
    capacity_multiplier = db.Column(db.Float)
    efficiency_multiplier = db.Column(db.Float)
    # percentage of the facility that is currently used
    usage = db.Column(db.Float, default=0)

    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))


class Shipment(db.Model):
    """Class that stores the resources shipment on their way"""

    id = db.Column(db.Integer, primary_key=True)
    resource = db.Column(db.String(10))
    quantity = db.Column(db.Float)
    departure_time = db.Column(db.Integer)
    duration = db.Column(db.Integer)
    suspension_time = db.Column(db.Integer, default=None)  # time at witch the shipment has been paused if it has
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))  # can access player directly with .player


class Resource_on_sale(db.Model):
    """Class that stores resources currently on sale"""

    id = db.Column(db.Integer, primary_key=True)
    resource = db.Column(db.String(10))
    quantity = db.Column(db.Float)
    price = db.Column(db.Float)
    creation_date = db.Column(db.DateTime)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))  # can access player directly with .player
