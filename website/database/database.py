"""
Here are defined the classes for the items stored in the database
"""

from .. import db

# table that links chats to players
player_chats = db.Table(
    "player_chats",
    db.Column("player_id", db.Integer, db.ForeignKey("player.id")),
    db.Column("chat_id", db.Integer, db.ForeignKey("chat.id")),
)

# table that links notifications to players
player_notifications = db.Table(
    "player_notifications",
    db.Column("player_id", db.Integer, db.ForeignKey("player.id")),
    db.Column("notification_id", db.Integer, db.ForeignKey("notification.id")),
)


class Under_construction(db.Model):
    """class that stores the things currently under construction"""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    family = db.Column(db.String(50))
    # to assign the thing to the correct page
    start_time = db.Column(db.Float)
    duration = db.Column(db.Float)
    suspension_time = db.Column(db.Float)
    # time at witch the construction has been paused if it has
    original_price = db.Column(db.Float)
    # Price of the construction on the time of start of construction
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))
    # can access player directly with .player


class Active_facilites(db.Model):
    """Class that stores the facilites on the server and their end of life time."""

    id = db.Column(db.Integer, primary_key=True)
    facility = db.Column(db.String(50))
    end_of_life = db.Column(db.Float)
    # time at witch the facility will be decomissioned
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))
    # can access player directly with .player


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
