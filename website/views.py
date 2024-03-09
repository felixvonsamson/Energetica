"""
In this file, the main routes of the website are managed
"""

from flask import Blueprint, render_template, request, flash
from flask import g, current_app
from flask_login import login_required, current_user

from .database.player import Player
from . import db
from .database.database import Chat, Resource_on_sale
from .utils import check_existing_chats

views = Blueprint("views", __name__)
overviews = Blueprint("overviews", __name__, static_folder="static")


def flash_error(msg):
    return flash(msg, category="error")


# this function is executed once before every request :
@views.before_request
@overviews.before_request
@login_required
def check_user():
    g.engine = current_app.config["engine"]
    g.config = g.engine.config[current_user.id]

    def render_template_ctx(page):
        if page == "wiki.jinja":
            return render_template(
                "wiki.jinja", engine=g.engine, user=current_user, data=g.config
            )
        # show location choice if player didn't choose yet
        if current_user.tile is None:
            return render_template("location_choice.jinja")
        # render template with or without player production data
        if page == "messages.jinja":
            chats = Chat.query.filter(
                Chat.participants.any(id=current_user.id)
            ).all()
            return render_template(
                page,
                engine=g.engine,
                user=current_user,
                chats=chats,
                data=g.config,
            )
        elif page == "resource_market.jinja":
            on_sale = Resource_on_sale.query.all()
            return render_template(
                page,
                engine=g.engine,
                user=current_user,
                on_sale=on_sale,
                data=g.config,
            )
        else:
            return render_template(
                page, engine=g.engine, user=current_user, data=g.config
            )

    g.render_template_ctx = render_template_ctx


@views.route("/", methods=["GET", "POST"])
@views.route("/home", methods=["GET", "POST"])
def home():
    return g.render_template_ctx("home.jinja")


@views.route("/map", methods=["GET", "POST"])
def map():
    return g.render_template_ctx("map.jinja")


@views.route("/profile")
def profile():
    player_name = request.args.get("player_name")
    player = Player.query.filter_by(username=player_name).first()
    return render_template(
        "profile.jinja",
        engine=g.engine,
        user=current_user,
        profile=player,
        data=g.config,
    )


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
                name=current_user.username + buddy_username,
                participants=[current_user, buddy],
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
def power_facilities():
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


@views.route("/extraction_facilities")
def extraction_facilities():
    return g.render_template_ctx("extraction_facilities.jinja")


@views.route("/resource_market", methods=["GET"])
def resource_market():
    return g.render_template_ctx("resource_market.jinja")


@views.route("/scoreboard")
def scoreboard():
    return g.render_template_ctx("scoreboard.jinja")


@views.route("/wiki")
def wiki():
    return g.render_template_ctx("wiki.jinja")


@overviews.route("/revenues")
def revenues():
    return g.render_template_ctx("overviews/revenues.jinja")


@overviews.route("/electricity")
def electricity():
    return g.render_template_ctx("overviews/electricity.jinja")


@overviews.route("/storage")
def storage():
    return g.render_template_ctx("overviews/storage.jinja")


@overviews.route("/resources")
def resources():
    return g.render_template_ctx("overviews/resources.jinja")


@overviews.route("/emissions")
def emissions():
    return g.render_template_ctx("overviews/emissions.jinja")
