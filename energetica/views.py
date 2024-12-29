"""This module is responsible for serving the Jinja templates to the user."""

from functools import partial

from flask import Blueprint, g, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from energetica.database.messages import Chat
from energetica.database.player import Player
from energetica.database.resource_on_sale import ResourceOnSale
from energetica.globals import engine

landing = Blueprint("landing", __name__, static_folder="static")
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
    player: Player = current_user
    if player.tile is None:
        return redirect("/location_choice", code=302)

    render_template_ctx = partial(
        render_template,
        user=player,
    )
    g.render_template_ctx = render_template_ctx


@landing.before_request
@wiki.before_request
@changelog.before_request
def set_ctx_no_login():
    """This function is called before every request"""
    user = current_user if current_user.is_authenticated and current_user.tile is not None else None
    render_template_ctx = partial(render_template, engine=engine, user=user)
    g.render_template_ctx = render_template_ctx


@location_choice_views.route("/location_choice", methods=["GET"])
@login_required
def location_choice():
    player: Player = current_user
    if player.tile is not None:
        return redirect(url_for("views.home"))
    return render_template("location_choice.jinja", engine=engine)


@views.route("/home")
def home():
    return g.render_template_ctx("dashboard.jinja")


@views.route("/settings")
def settings():
    return g.render_template_ctx("settings.jinja")


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
        player: Player = current_user
        player_id = player.id
    player = Player.get(player_id)
    return g.render_template_ctx("profile.jinja", profile=player)


@views.route("/messages", methods=["GET", "POST"])
def messages():
    player: Player = current_user
    chats = list(Chat.filter(lambda chat: player in chat.participants))
    return g.render_template_ctx("messages.jinja", chats=chats)


@views.route("/network")
def network():
    player: Player = current_user
    if "Unlock Network" not in player.achievements:
        return redirect("/home", code=302)
    return g.render_template_ctx("network.jinja")


@views.route("/power_facilities")
def power_facilities():
    player: Player = current_user
    return g.render_template_ctx("assets/power_facilities.jinja", constructions=player.cache.power_facilities_data)


@views.route("/storage_facilities")
def storage_facilities():
    player: Player = current_user
    return g.render_template_ctx("assets/storage_facilities.jinja", constructions=player.cache.storage_facilities_data)


@views.route("/technology")
def technology():
    player: Player = current_user
    if "Unlock Technologies" not in player.achievements:
        return redirect("/home", code=302)
    return g.render_template_ctx("assets/technologies.jinja", available_technologies=player.cache.technologies_data)


@views.route("/functional_facilities")
def functional_facilities():
    player: Player = current_user
    return g.render_template_ctx(
        "assets/functional_facilities.jinja", constructions=player.cache.functional_facilities_data
    )


@views.route("/extraction_facilities")
def extraction_facilities():
    player: Player = current_user
    if "Unlock Natural Resources" not in player.achievements:
        return redirect("/home", code=302)
    return g.render_template_ctx(
        "assets/extraction_facilities.jinja", constructions=player.cache.extraction_facilities_data
    )


@views.route("/resource_market")
def resource_market():
    player: Player = current_user
    if "Unlock Natural Resources" not in player.achievements:
        return redirect("/home", code=302)
    on_sale = ResourceOnSale.all()
    return g.render_template_ctx("resource_market.jinja", on_sale=on_sale)


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
    player: Player = current_user
    if "First Storage Facility" not in player.achievements:
        return redirect("/home", code=302)
    return g.render_template_ctx("overviews/storage.jinja")


@overviews.route("/resources")
def resources():
    player: Player = current_user
    if "Unlock Natural Resources" not in player.achievements:
        return redirect("/home", code=302)
    return g.render_template_ctx("overviews/resources.jinja")


@overviews.route("/emissions")
def emissions():
    player: Player = current_user
    if not player.discovered_greenhouse_gas_effect():
        return redirect("/home", code=302)
    return g.render_template_ctx("overviews/emissions.jinja")


@landing.route("/")
@landing.route("/landing")
def landing_page():
    if current_user.is_authenticated and request.path == "/":
        return redirect("/home")
    return g.render_template_ctx("landing.jinja")


@wiki.route("/<template_name>")
def render_template_wiki(template_name):
    valid_templates = [
        "introduction",
        "time_and_weather",
        "map",
        "projects",
        "power_facilities",
        "storage_facilities",
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
