"""
In this file, the main routes of the website are managed
"""

from flask import Blueprint, render_template, request, flash, jsonify, session
from flask import g, current_app
from flask_login import login_required, current_user
import pickle
import datetime
from . import db
from .database import Chat, Player
from .utils import check_existing_chats

views = Blueprint("views", __name__)

flash_error = lambda msg: flash(msg, category="error")

# this function is executed once before every request :
@views.before_request
@login_required
def check_user():
    g.engine = current_app.config["engine"]
    g.config = g.engine.config[current_user.id]

    def render_template_ctx(page):
        # render template with or without player production data
        if page == "production_overview.jinja":
            with open(
                "instance/player_prod/" + current_user.production_table_name, "rb"
            ) as file:
                prod_table = pickle.load(file)
            return render_template(
                page,
                engine=g.engine,
                user=current_user,
                data=g.config["assets"],
                prod_table=prod_table,
                t=datetime.datetime.today().time(),
            )
        elif page == "messages.jinja":
            chats=Chat.query.filter(Chat.participants.any(id=current_user.id)).all()
            return render_template(
                page,
                engine=g.engine,
                user=current_user,
                chats=chats
            )
        else:
            return render_template(
                page,
                engine=g.engine,
                user=current_user,
                data=g.config["assets"]
            )

    g.render_template_ctx = render_template_ctx
    if len(current_user.tile) == 0:
        return g.render_template_ctx("location_choice.jinja")

@views.route("/", methods=["GET", "POST"])
@views.route("/home", methods=["GET", "POST"])
def home():
    return g.render_template_ctx("home.jinja")

@views.route("/messages", methods=["GET", "POST"])
def messages():
    if request.method == "POST":
        # If player is trying to create a chat with one other player
        if "add_chat_username" in request.form:
            buddy_username = request.form.get("add_chat_username")
            if buddy_username == current_user.username:
                flash_error("Cannot create a chat with yourself")
                return g.render_template_ctx("messages.jinja")
            buddy = Player.query.filter_by(username=buddy_username).first()
            if buddy is None:
                flash_error("No Player with this username")
                return g.render_template_ctx("messages.jinja")
            if check_existing_chats([current_user, buddy]):
                flash_error("Chat already exists")
                return g.render_template_ctx("messages.jinja")
            new_chat = Chat(
                name=current_user.username+buddy_username,
                participants=[current_user, buddy]
                )
            db.session.add(new_chat)
            db.session.commit()
        else:
            current_user.show_disclamer = False
            if request.form.get("dont_show_disclaimer") == "on":
                db.session.commit()
    return g.render_template_ctx("messages.jinja")

@views.route("/network")
def network():
    return g.render_template_ctx("network.jinja")

@views.route("/power_facilities")
def energy_facilities():
    return g.render_template_ctx("power_facilities.jinja")

@views.route("/storage_facilities")
def storage_facilities():
    return g.render_template_ctx("storage_facilities.jinja")

@views.route("/technology")
def technology():
    return g.render_template_ctx("technologies.jinja")

@views.route("/functional_facilities")
def functional_facilities():
    return g.render_template_ctx("functional_facilities.jinja")

@views.route("/extraction_plants")
def extraction_plants():
    return g.render_template_ctx("extraction_plants.jinja")

@views.route("/production_overview")
def production_overview():
    return g.render_template_ctx("production_overview.jinja")