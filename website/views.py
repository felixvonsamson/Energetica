"""In this file, the main routes of the website are managed"""

from functools import partial

from flask import Blueprint, current_app, g, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from .database.messages import Chat
from .database.player import Player
from .database.player_assets import ResourceOnSale
from .technology_effects import (
    get_current_technology_values,
    package_available_technologies,
    package_extraction_facilities,
    package_functional_facilities,
    package_power_facilities,
    package_storage_facilities,
)

location_choice_views = Blueprint("location_choice_views", __name__)
views = Blueprint("views", __name__)
overviews = Blueprint("overviews", __name__, static_folder="static")
wiki = Blueprint("wiki", __name__, static_folder="static")
changelog = Blueprint("changelog", __name__, static_folder="static")


@views.before_request
@overviews.before_request
@login_required
def set_ctx():
    """This function is called before every request"""
    if current_user.tile is None:
        return redirect("/location_choice", code=302)

    render_template_ctx = partial(
        render_template,
        engine=current_app.config["engine"],
        user=current_user,
        data=get_current_technology_values(current_user),
    )
    g.render_template_ctx = render_template_ctx


@wiki.before_request
@changelog.before_request
def set_ctx_no_login():
    """This function is called before every request"""
    user, data = (
        (current_user, get_current_technology_values(current_user))
        if current_user.is_authenticated and current_user.tile is not None
        else (None, None)
    )

    render_template_ctx = partial(render_template, engine=current_app.config["engine"], user=user, data=data)
    g.render_template_ctx = render_template_ctx


@location_choice_views.route("/location_choice", methods=["GET"])
@login_required
def location_choice():
    if current_user.tile is not None:
        return redirect(url_for("views.home"))
    return render_template("location_choice.jinja", engine=current_app.config["engine"])


@views.route("/")
@views.route("/home")
def home():
    return g.render_template_ctx("dashboard.jinja")


@views.route("/map_view")
def map_view():
    return g.render_template_ctx("map.jinja")


@views.route("/profile")
def profile():
    """
    This is the endpoint for the profile page.
    When players are on their own profile page, it can see more information about their account
    """
    player_id = request.args.get("player_id")
    if player_id is None:
        player_id = current_user.id
    player = Player.query.get(player_id)
    return g.render_template_ctx("profile.jinja", profile=player)


@views.route("/messages", methods=["GET", "POST"])
def messages():
    chats = Chat.query.filter(Chat.participants.any(id=current_user.id)).all()
    return g.render_template_ctx("messages.jinja", chats=chats)


@views.route("/network")
def network():
    if "Unlock Network" not in current_user.achievements:
        return redirect("/home", code=302)
    return g.render_template_ctx("network.jinja")


@views.route("/power_facilities")
def power_facilities():
    return g.render_template_ctx("assets/power_facilities.jinja", constructions=package_power_facilities(current_user))


@views.route("/storage_facilities")
def storage_facilities():
    return g.render_template_ctx(
        "assets/storage_facilities.jinja", constructions=package_storage_facilities(current_user)
    )


@views.route("/technology")
def technology():
    if "Unlock Technologies" not in current_user.achievements:
        return redirect("/home", code=302)
    return g.render_template_ctx(
        "assets/technologies.jinja", available_technologies=package_available_technologies(current_user)
    )


@views.route("/functional_facilities")
def functional_facilities():
    return g.render_template_ctx(
        "assets/functional_facilities.jinja", constructions=package_functional_facilities(current_user)
    )


@views.route("/extraction_facilities")
def extraction_facilities():
    if "Unlock Natural Resources" not in current_user.achievements:
        return redirect("/home", code=302)
    return g.render_template_ctx(
        "assets/extraction_facilities.jinja", constructions=package_extraction_facilities(current_user)
    )


@views.route("/resource_market")
def resource_market():
    if "Unlock Natural Resources" not in current_user.achievements:
        return redirect("/home", code=302)
    on_sale = ResourceOnSale.query.all()
    return g.render_template_ctx("resource_market.jinja", on_sale=on_sale, data=g.data)


@views.route("/scoreboard")
def scoreboard():
    return g.render_template_ctx("scoreboard.jinja")


@overviews.route("/revenues")
def revenues():
    return g.render_template_ctx("overviews/revenues.jinja")


@overviews.route("/electricity")
def electricity():
    return g.render_template_ctx("overviews/electricity.jinja")


@overviews.route("/storage")
def storage():
    if "First Storage Facility" not in current_user.achievements:
        return redirect("/home", code=302)
    return g.render_template_ctx("overviews/storage.jinja")


@overviews.route("/resources")
def resources():
    if "Unlock Natural Resources" not in current_user.achievements:
        return redirect("/home", code=302)
    return g.render_template_ctx("overviews/resources.jinja")


@overviews.route("/emissions")
def emissions():
    if "Discover the Greenhouse Effect" not in current_user.achievements:
        return redirect("/home", code=302)
    return g.render_template_ctx("overviews/emissions.jinja")


@wiki.route("/<template_name>")
def render_template_wiki(template_name):
    valid_templates = [
        "introduction",
        "time_and_weather",
        "map",
        "power_facilities",
        "storage_facilities",
        "extraction_facilities",
        "functional_facilities",
        "technologies",
        "power_management",
        "network",
        "resources",
        "climate_effects",
    ]

    if template_name in valid_templates:
        return g.render_template_ctx(f"wiki/{template_name}.jinja")
    else:
        return "404 Not Found", 404


@changelog.route("/changelog")
def render_changelog():
    return g.render_template_ctx("changelog.jinja")
