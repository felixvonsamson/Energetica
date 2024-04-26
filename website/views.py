"""
In this file, the main routes of the website are managed
"""

from flask import Blueprint, redirect, render_template, request, flash
from flask import g, current_app
from flask_login import login_required, current_user
from datetime import datetime

from .database.messages import Chat

from .database.player import Player
from . import db
from .database.player_assets import Resource_on_sale

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
    if current_user.tile is not None:
        g.config = g.engine.config[current_user.id]

    def render_template_ctx(page):
        if page in ["wiki.jinja", "changelog.jinja"]:
            if current_user.tile is not None:
                return render_template(
                    page,
                    engine=g.engine,
                    user=current_user,
                    data=g.config,
                )
            return render_template("wiki.jinja", engine=g.engine, user=None)
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


@views.route("/")
@views.route("/home")
def home():
    return g.render_template_ctx("home.jinja")


@views.route("/map")
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
    return g.render_template_ctx("messages.jinja")


@views.route("/network")
def network():
    if "network" not in current_user.advancements:
        return redirect("/home", code=302)
    return g.render_template_ctx("network.jinja")


@views.route("/power_facilities")
def power_facilities():
    return g.render_template_ctx("power_facilities.jinja")


@views.route("/storage_facilities")
def storage_facilities():
    return g.render_template_ctx("storage_facilities.jinja")


@views.route("/technology")
def technology():
    if "technology" not in current_user.advancements:
        return redirect("/home", code=302)
    return g.render_template_ctx("technologies.jinja")


@views.route("/functional_facilities")
def functional_facilities():
    return g.render_template_ctx("functional_facilities.jinja")


@views.route("/extraction_facilities")
def extraction_facilities():
    if "warehouse" not in current_user.advancements:
        return redirect("/home", code=302)
    return g.render_template_ctx("extraction_facilities.jinja")


@views.route("/resource_market")
def resource_market():
    if "warehouse" not in current_user.advancements:
        return redirect("/home", code=302)
    return g.render_template_ctx("resource_market.jinja")


@views.route("/scoreboard")
def scoreboard():
    return g.render_template_ctx("scoreboard.jinja")


@views.route("/wiki")
def wiki():
    return g.render_template_ctx("wiki.jinja")

@views.route("/changelog")
def changelog():
    return g.render_template_ctx("changelog.jinja")


@overviews.route("/revenues")
def revenues():
    return g.render_template_ctx("overviews/revenues.jinja")


@overviews.route("/electricity")
def electricity():
    return g.render_template_ctx("overviews/electricity.jinja")


@overviews.route("/storage")
def storage():
    if "storage_overview" not in current_user.advancements:
        return redirect("/home", code=302)
    return g.render_template_ctx("overviews/storage.jinja")


@overviews.route("/resources")
def resources():
    if "warehouse" not in current_user.advancements:
        return redirect("/home", code=302)
    return g.render_template_ctx("overviews/resources.jinja")


@overviews.route("/emissions")
def emissions():
    if "GHG_effect" not in current_user.advancements:
        return redirect("/home", code=302)
    return g.render_template_ctx("overviews/emissions.jinja")
