"""Module that contains the classes for the built-in chat."""

from energetica.database import db


class Chat(db.Model):
    """Class for chats with 2 or more players."""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    messages = db.relationship("Message", backref="chat", lazy="dynamic")


class Message(db.Model):
    """Class for storing data about messages for the in-game messaging system."""

    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text)
    time = db.Column(db.DateTime)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))
    chat_id = db.Column(db.Integer, db.ForeignKey("chat.id"))

    def package(self) -> dict:
        """Package this message's data into a dictionary."""
        return {
            "id": self.id,
            "text": self.text,
            "date": self.time.timestamp(),
            "player_id": self.player_id,
        }


class Notification(db.Model):
    """Class for storing data about in-game notifications."""

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(50))
    content = db.Column(db.Text)
    time = db.Column(db.DateTime)
    read = db.Column(db.Boolean, default=False)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))


# table that links chats to players
player_chats = db.Table(
    "player_chats",
    db.Column("player_id", db.Integer, db.ForeignKey("player.id")),
    db.Column("chat_id", db.Integer, db.ForeignKey("chat.id")),
)
