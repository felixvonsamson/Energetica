"""Module responsible for serving the Jinja templates to the user."""

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
    """Set up the context and redirects if the user has no tile."""
    if current_user.tile is None:
        return redirect("/location_choice", code=302)

    render_template_ctx = partial(
        render_template,
        engine=engine,
        user=current_user,
    )
    g.render_template_ctx = render_template_ctx


@landing.before_request
@wiki.before_request
@changelog.before_request
def set_ctx_no_login():
    """Set a context for rendering templates without requiring user login, storing it in the global object."""
    user = current_user if current_user.is_authenticated and current_user.tile is not None else None
    render_template_ctx = partial(render_template, engine=engine, user=user)
    g.render_template_ctx = render_template_ctx


@location_choice_views.route("/location_choice", methods=["GET"])
@login_required
def location_choice():
    if current_user.tile is not None:
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
    Serve the profile page.

    When players are on their own profile page, they can see more information about their account.
    """
    player_id_str = request.args.get("player_id")
    if player_id_str is None:
        player_id = current_user.id
    else:
        player_id = int(player_id_str)
    player = Player.get(player_id)
    return g.render_template_ctx("profile.jinja", profile=player)


@views.route("/messages", methods=["GET", "POST"])
def messages():
    player = Player.getitem(current_user.id)
    chats = list(Chat.filter(lambda chat: player in chat.participants))
    return g.render_template_ctx("messages.jinja", chats=chats)


@views.route("/network")
def network():
    if not current_user.achievements["network"]:
        return redirect("/home", code=302)
    return g.render_template_ctx("network.jinja")


@views.route("/power_facilities")
def power_facilities():
    return g.render_template_ctx("assets/power_facilities.jinja", constructions=current_user.power_facilities_data)


@views.route("/storage_facilities")
def storage_facilities():
    return g.render_template_ctx("assets/storage_facilities.jinja", constructions=current_user.storage_facilities_data)


@views.route("/technology")
def technology():
    if not current_user.achievements["laboratory"]:
        return redirect("/home", code=302)
    return g.render_template_ctx("assets/technologies.jinja", available_technologies=current_user.technologies_data)


@views.route("/functional_facilities")
def functional_facilities():
    return g.render_template_ctx(
        "assets/functional_facilities.jinja", constructions=current_user.functional_facilities_data
    )


@views.route("/extraction_facilities")
def extraction_facilities():
    if not current_user.achievements["warehouse"]:
        return redirect("/home", code=302)
    return g.render_template_ctx(
        "assets/extraction_facilities.jinja", constructions=current_user.extraction_facilities_data
    )


@views.route("/resource_market")
def resource_market():
    if not current_user.achievements["warehouse"]:
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
    if not current_user.achievements["storage_facilities"]:
        return redirect("/home", code=302)
    return g.render_template_ctx("overviews/storage.jinja")


@overviews.route("/resources")
def resources():
    if not current_user.achievements["warehouse"]:
        return redirect("/home", code=302)
    return g.render_template_ctx("overviews/resources.jinja")


@overviews.route("/emissions")
def emissions():
    if not current_user.discovered_greenhouse_gas_effect():
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
